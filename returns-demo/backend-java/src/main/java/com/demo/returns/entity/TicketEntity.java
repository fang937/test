package com.demo.returns.entity;

import com.demo.returns.domain.AftersaleStatus;
import com.demo.returns.domain.TicketType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

/** 售后单；ticketNo 为对外单号（AS0001），seq 为内部排序号 */
@Entity
@Table(name = "aftersale_tickets")
public class TicketEntity {
    @Id
    @Column(name = "ticket_no", length = 20)
    private String ticketNo;

    @Column(nullable = false, unique = true)
    private long seq;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "order_id")
    private OrderEntity order;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "item_fk")
    private OrderItemEntity item;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id")
    private UserEntity user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private TicketType type;

    @Column(nullable = false, length = 100)
    private String reason;

    @Column(nullable = false)
    private int qty;

    @Column(length = 1000)
    private String description = "";

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private AftersaleStatus status;

    @Column(name = "refund_amount")
    private Integer refundAmount;

    @Column(name = "reship_tracking_no", length = 40)
    private String reshipTrackingNo;

    @Column(name = "inspect_result", length = 10)
    private String inspectResult; // OK / PROBLEM

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    public TicketEntity() {}

    /** 新建售后单（创建后除状态/结论类字段外不再变更） */
    public TicketEntity(String ticketNo, long seq, OrderEntity order, OrderItemEntity item,
                        UserEntity user, TicketType type, String reason, int qty,
                        String description, AftersaleStatus status,
                        LocalDateTime createdAt, LocalDateTime updatedAt) {
        this.ticketNo = ticketNo;
        this.seq = seq;
        this.order = order;
        this.item = item;
        this.user = user;
        this.type = type;
        this.reason = reason;
        this.qty = qty;
        this.description = description;
        this.status = status;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public String getTicketNo() { return ticketNo; }
    public long getSeq() { return seq; }
    public OrderEntity getOrder() { return order; }
    public OrderItemEntity getItem() { return item; }
    public UserEntity getUser() { return user; }
    public TicketType getType() { return type; }
    public String getReason() { return reason; }
    public int getQty() { return qty; }
    public String getDescription() { return description; }
    public AftersaleStatus getStatus() { return status; }
    public Integer getRefundAmount() { return refundAmount; }
    public String getReshipTrackingNo() { return reshipTrackingNo; }
    public String getInspectResult() { return inspectResult; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }

    public void setDescription(String description) { this.description = description; }
    public void setStatus(AftersaleStatus status) { this.status = status; }
    public void setRefundAmount(Integer refundAmount) { this.refundAmount = refundAmount; }
    public void setReshipTrackingNo(String reshipTrackingNo) { this.reshipTrackingNo = reshipTrackingNo; }
    public void setInspectResult(String inspectResult) { this.inspectResult = inspectResult; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
