package com.demo.returns.service;

import com.demo.returns.common.ApiException;
import com.demo.returns.domain.AftersaleStatus;
import com.demo.returns.domain.Role;
import com.demo.returns.domain.TicketType;
import com.demo.returns.dto.OrderView;
import com.demo.returns.dto.TicketView;
import com.demo.returns.dto.CreateTicketRequest;
import com.demo.returns.dto.ReviewRequest;
import com.demo.returns.dto.SupplementRequest;
import com.demo.returns.dto.WarehouseRequest;
import com.demo.returns.entity.OrderEntity;
import com.demo.returns.entity.OrderItemEntity;
import com.demo.returns.entity.TicketEntity;
import com.demo.returns.entity.TicketEventEntity;
import com.demo.returns.entity.TicketImageEntity;
import com.demo.returns.entity.UserEntity;
import com.demo.returns.repository.OrderItemRepository;
import com.demo.returns.repository.OrderRepository;
import com.demo.returns.repository.TicketEventRepository;
import com.demo.returns.repository.TicketImageRepository;
import com.demo.returns.repository.TicketRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * 售后业务规则（核心）：
 * - 只能对本人已完成订单申请售后；
 * - 申请数量不能超过剩余可售后数量（进行中的申请占用数量）；
 * - 状态流转必须符合状态机；
 * - 审核意见 / 补充材料 / 验货异常必须填写原因；
 * - 每次状态变化写入时间线（岗位 + 时间 + 说明）。
 */
@Service
public class AftersaleService {

    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("yyyy/M/d HH:mm:ss", Locale.CHINA);
    private static final String ORDER_COMPLETED = "COMPLETED";

    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final TicketRepository ticketRepository;
    private final TicketImageRepository imageRepository;
    private final TicketEventRepository eventRepository;

    public AftersaleService(OrderRepository orderRepository, OrderItemRepository orderItemRepository,
                            TicketRepository ticketRepository, TicketImageRepository imageRepository,
                            TicketEventRepository eventRepository) {
        this.orderRepository = orderRepository;
        this.orderItemRepository = orderItemRepository;
        this.ticketRepository = ticketRepository;
        this.imageRepository = imageRepository;
        this.eventRepository = eventRepository;
    }

    private static void require(boolean condition, String message) {
        if (!condition) throw ApiException.badRequest(message);
    }

    // ---------- 查询 ----------

    @Transactional(readOnly = true)
    public List<OrderView> myOrders(UserEntity user) {
        return orderRepository.findByUser_IdAndStatusOrderByIdAsc(user.getId(), ORDER_COMPLETED)
                .stream().map(this::toOrderView).toList();
    }

    @Transactional(readOnly = true)
    public List<TicketView> listMyTickets(UserEntity user) {
        return ticketRepository.findAllByUser_IdOrderBySeqDesc(user.getId())
                .stream().map(this::toView).toList();
    }

    @Transactional(readOnly = true)
    public List<TicketView> listStaffTickets(String status, String type) {
        AftersaleStatus statusEnum = parseEnumOrNull(AftersaleStatus.class, status);
        TicketType typeEnum = parseEnumOrNull(TicketType.class, type);
        List<TicketEntity> tickets;
        if (statusEnum != null && typeEnum != null) {
            tickets = ticketRepository.findAllByStatusAndTypeOrderBySeqDesc(statusEnum, typeEnum);
        } else if (statusEnum != null) {
            tickets = ticketRepository.findAllByStatusOrderBySeqDesc(statusEnum);
        } else if (typeEnum != null) {
            tickets = ticketRepository.findAllByTypeOrderBySeqDesc(typeEnum);
        } else {
            tickets = ticketRepository.findAllByOrderBySeqDesc();
        }
        return tickets.stream().map(this::toView).toList();
    }

    @Transactional(readOnly = true)
    public TicketView detail(UserEntity user, String ticketNo) {
        TicketEntity ticket = findTicket(ticketNo);
        // 规则：普通消费者不能查看他人订单和售后资料
        if (user.getRole() == Role.CONSUMER && !ticket.getUser().getId().equals(user.getId())) {
            throw ApiException.forbidden("无权查看他人售后单");
        }
        return toView(ticket);
    }

    // ---------- 消费者 ----------

    /** synchronized 仅做同进程去抖；并发安全由事务内 SELECT FOR UPDATE 保证 */
    @Transactional
    public synchronized TicketView createTicket(UserEntity user, CreateTicketRequest req) {
        TicketType type = parseType(req.type());
        require(req.orderId() != null && !req.orderId().isBlank()
                && req.itemId() != null && !req.itemId().isBlank(), "请选择订单商品");
        require(req.reason() != null && !req.reason().isBlank(), "请填写申请原因");
        require(req.reason().length() <= 100, "申请原因不能超过100字");
        String description = req.description() == null ? "" : req.description();
        require(description.length() <= 500, "补充说明不能超过500字");
        int qty = req.qty() == null ? 0 : req.qty();
        require(qty >= 1 && qty <= 99, "申请数量必须是1-99的整数");
        List<String> images = normalizeImages(req.images());

        OrderItemEntity item = orderItemRepository
                .lockByOrderNoAndItemId(req.orderId(), req.itemId())
                .orElseThrow(() -> ApiException.badRequest("只能对本人已完成的订单申请售后"));
        // 规则：只能对本人已完成订单申请售后
        require(item.getOrder().getUser().getId().equals(user.getId()),
                "只能对本人已完成的订单申请售后");
        require(ORDER_COMPLETED.equals(item.getOrder().getStatus()), "该订单尚未完成，不能申请售后");

        // 规则：申请数量不能超过剩余可售后数量（锁商品行后统计进行中的占用）
        long used = ticketRepository.sumInFlightQty(req.orderId(), req.itemId(), AftersaleStatus.REJECTED);
        long available = item.getAftersalableQty() - used;
        require(qty <= available, "申请数量超过可售后数量（剩余可申请 " + available + " 件）");

        long seq = ticketRepository.findMaxSeq() + 1;
        LocalDateTime now = LocalDateTime.now();
        TicketEntity ticket = ticketRepository.save(new TicketEntity(
                String.format("AS%04d", seq), seq, item.getOrder(), item, user, type,
                req.reason().trim(), qty, description, AftersaleStatus.SUBMITTED, now, now));

        for (String filename : images) {
            imageRepository.save(new TicketImageEntity(ticket, filename, now));
        }
        eventRepository.save(new TicketEventEntity(ticket, user.getName(), user.getRole(),
                "提交售后申请",
                type.getLabel() + " " + qty + " 件，原因：" + req.reason().trim() + "。"
                        + description.trim() + " 凭证：" + images.size() + " 张",
                now));
        return toView(ticket);
    }

    @Transactional
    public TicketView supplementTicket(UserEntity user, String ticketNo, SupplementRequest req) {
        TicketEntity ticket = findTicket(ticketNo);
        require(ticket.getUser().getId().equals(user.getId()), "无权操作他人售后单");
        List<String> images = normalizeImages(req.images());
        String description = req.description() == null ? "" : req.description();
        require(!description.isBlank() || !images.isEmpty(), "请补充说明或图片凭证");
        require(description.length() <= 500, "补充说明不能超过500字");

        String existing = ticket.getDescription() == null ? "" : ticket.getDescription();
        ticket.setDescription(existing.isBlank() ? "[补充] " + description : existing + "\n[补充] " + description);
        LocalDateTime now = LocalDateTime.now();
        for (String filename : images) {
            imageRepository.save(new TicketImageEntity(ticket, filename, now));
        }
        transit(ticket, AftersaleStatus.SUBMITTED, user, "补充材料",
                description.trim() + (images.isEmpty() ? "" : " 新增凭证 " + images.size() + " 张"));
        return toView(ticket);
    }

    // ---------- 客服 ----------

    @Transactional
    public TicketView review(UserEntity operator, String ticketNo, ReviewRequest req) {
        TicketEntity ticket = findTicket(ticketNo);
        String action = req.action();
        String note = req.note() == null ? "" : req.note().trim();
        switch (action == null ? "" : action) {
            case "REQUEST_MATERIAL" -> {
                requireNote(note, "要求补充材料");
                transit(ticket, AftersaleStatus.MATERIAL_REQUESTED, operator, "要求补充材料", note);
            }
            case "APPROVE_RETURN" -> {
                requireNote(note, "同意退回");
                transit(ticket, AftersaleStatus.RETURN_APPROVED, operator, "同意退回",
                        note + "（请按退回指引寄回商品）");
            }
            case "REJECT" -> {
                requireNote(note, "拒绝申请");
                transit(ticket, AftersaleStatus.REJECTED, operator, "拒绝申请", note);
            }
            case "FINAL_APPROVE" -> {
                requireNote(note, "给出最终结论");
                if (ticket.getStatus() != AftersaleStatus.INSPECTED) {
                    throw new ApiException(409, "需先完成仓库验货，才能给出最终结论");
                }
                if (ticket.getType() == TicketType.RETURN) {
                    // 模拟退款：不接真实资金
                    int amount = ticket.getItem().getPrice() * ticket.getQty();
                    ticket.setRefundAmount(amount);
                    ticket.setStatus(AftersaleStatus.COMPLETED);
                    eventRepository.save(new TicketEventEntity(ticket, operator.getName(),
                            operator.getRole(), "模拟退款完成",
                            "模拟退款完成，退款金额 ￥" + amount + "（模拟，不接真实资金）。" + note,
                            LocalDateTime.now()));
                } else {
                    // 换货：记录模拟补发单号
                    String trackingNo = "SF" + System.currentTimeMillis();
                    ticket.setReshipTrackingNo(trackingNo);
                    ticket.setStatus(AftersaleStatus.COMPLETED);
                    eventRepository.save(new TicketEventEntity(ticket, operator.getName(),
                            operator.getRole(), "安排换货补发",
                            "已安排换货补发，模拟补发单号 " + trackingNo + "。" + note,
                            LocalDateTime.now()));
                }
            }
            default -> throw ApiException.badRequest("未知审核操作");
        }
        ticket.setUpdatedAt(LocalDateTime.now());
        return toView(ticket);
    }

    // ---------- 仓库 ----------

    @Transactional
    public TicketView receive(UserEntity operator, String ticketNo, WarehouseRequest req) {
        TicketEntity ticket = findTicket(ticketNo);
        if (ticket.getStatus() != AftersaleStatus.RETURN_APPROVED) {
            // 规则：客服同意退回后，仓库才能登记收货（状态冲突 409）
            throw new ApiException(409, "客服尚未同意退回，不能提前登记收货");
        }
        String note = req.note() == null ? "" : req.note().trim();
        transit(ticket, AftersaleStatus.RECEIVED, operator, "登记收到退回包裹", note);
        return toView(ticket);
    }

    @Transactional
    public TicketView inspect(UserEntity operator, String ticketNo, WarehouseRequest req) {
        TicketEntity ticket = findTicket(ticketNo);
        require("OK".equals(req.inspectResult()) || "PROBLEM".equals(req.inspectResult()),
                "请选择验货结果：通过或异常");
        String note = req.note() == null ? "" : req.note().trim();
        // 规则：验货异常必须填写原因
        require(!"PROBLEM".equals(req.inspectResult()) || !note.isBlank(), "验货异常必须填写原因说明");
        transit(ticket, AftersaleStatus.INSPECTED, operator,
                "PROBLEM".equals(req.inspectResult()) ? "验货异常" : "验货通过",
                note.isBlank() ? "商品与申请一致" : note);
        ticket.setInspectResult(req.inspectResult());
        ticket.setUpdatedAt(LocalDateTime.now());
        return toView(ticket);
    }

    // ---------- 内部工具 ----------

    private void requireNote(String note, String action) {
        require(!note.isBlank(), "执行「" + action + "」必须填写原因或说明");
    }

    /** 状态机冲突：请求与当前单据状态不匹配，属客户端状态错误（409），区别于业务规则 400 */
    private void transit(TicketEntity ticket, AftersaleStatus target,
                         UserEntity operator, String action, String note) {
        if (!ticket.getStatus().canTransitTo(target)) {
            throw new ApiException(409, "当前状态「" + ticket.getStatus().getLabel()
                    + "」不允许执行「" + action + "」");
        }
        ticket.setStatus(target);
        ticket.setUpdatedAt(LocalDateTime.now());
        eventRepository.save(new TicketEventEntity(ticket, operator.getName(), operator.getRole(),
                action, note, LocalDateTime.now()));
    }

    private TicketEntity findTicket(String ticketNo) {
        return ticketRepository.findByTicketNo(ticketNo)
                .orElseThrow(() -> ApiException.notFound("售后单不存在"));
    }

    private List<String> normalizeImages(List<String> images) {
        if (images == null) return List.of();
        List<String> result = new ArrayList<>(images.stream().limit(9).toList());
        require(result.stream().allMatch(f -> f != null && f.length() <= 200), "凭证文件名过长");
        return result;
    }

    private TicketType parseType(String code) {
        try {
            return TicketType.valueOf(code);
        } catch (IllegalArgumentException | NullPointerException e) {
            throw ApiException.badRequest("售后类型必须是退货或换货");
        }
    }

    private <E extends Enum<E>> E parseEnumOrNull(Class<E> type, String code) {
        if (code == null || code.isBlank()) return null;
        try {
            return Enum.valueOf(type, code);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private OrderView toOrderView(OrderEntity order) {
        List<OrderView.ItemView> items = orderItemRepository.findByOrder_IdOrderByIdAsc(order.getId())
                .stream().map(it -> new OrderView.ItemView(
                        it.getItemId(), it.getName(), it.getPrice(), it.getQty(),
                        it.getAftersalableQty(),
                        (int) ticketRepository.sumInFlightQty(order.getOrderNo(), it.getItemId(),
                                AftersaleStatus.REJECTED)))
                .toList();
        return new OrderView(order.getOrderNo(), order.getStatus(), FMT.format(order.getCreatedAt()), items);
    }

    private TicketView toView(TicketEntity t) {
        List<String> images = imageRepository.findByTicket_TicketNoOrderByIdAsc(t.getTicketNo())
                .stream().map(TicketImageEntity::getFilename).toList();
        List<TicketView.TimelineEntry> timeline = eventRepository
                .findByTicket_TicketNoOrderByIdAsc(t.getTicketNo())
                .stream().map(e -> new TicketView.TimelineEntry(
                        FMT.format(e.getCreatedAt()),
                        e.getOperatorName() + "（" + e.getOperatorRole().getLabel() + "）",
                        e.getOperatorRole().getCode(),
                        e.getAction(),
                        e.getNote() == null ? "" : e.getNote()))
                .toList();
        return new TicketView(
                t.getTicketNo(), t.getOrder().getOrderNo(), t.getItem().getItemId(),
                t.getItem().getName(), t.getItem().getPrice(),
                t.getUser().getId(), t.getUser().getName(),
                t.getType().name(), t.getReason(), t.getQty(),
                t.getDescription() == null ? "" : t.getDescription(),
                t.getStatus().name(), t.getStatus().getLabel(),
                t.getRefundAmount(), t.getReshipTrackingNo(), t.getInspectResult(),
                FMT.format(t.getCreatedAt()), images, timeline);
    }
}
