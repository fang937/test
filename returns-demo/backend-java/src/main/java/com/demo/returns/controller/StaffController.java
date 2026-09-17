package com.demo.returns.controller;

import com.demo.returns.common.ApiException;
import com.demo.returns.common.AuthInterceptor;
import com.demo.returns.common.RequireRole;
import com.demo.returns.dto.ReviewRequest;
import com.demo.returns.dto.WarehouseRequest;
import com.demo.returns.dto.TicketView;
import com.demo.returns.entity.UserEntity;
import com.demo.returns.service.AftersaleService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** 客服与仓库接口 */
@RestController
@RequestMapping("/api")
public class StaffController {

    private final AftersaleService aftersaleService;

    public StaffController(AftersaleService aftersaleService) {
        this.aftersaleService = aftersaleService;
    }

    /** 工作台列表，支持 ?status= &type= 筛选 */
    @GetMapping("/tickets")
    @RequireRole({"service", "warehouse"})
    public List<TicketView> list(@RequestParam(required = false) String status,
                                 @RequestParam(required = false) String type) {
        return aftersaleService.listStaffTickets(status, type);
    }

    /** 详情：所有登录角色可查；消费者只能看本人单据（服务层校验） */
    @GetMapping("/tickets/{id}")
    public TicketView detail(@RequestAttribute(AuthInterceptor.USER_ATTR) UserEntity user,
                             @PathVariable String id) {
        return aftersaleService.detail(user, id);
    }

    @PostMapping("/tickets/{id}/review")
    @RequireRole("service")
    public TicketView review(@RequestAttribute(AuthInterceptor.USER_ATTR) UserEntity user,
                             @PathVariable String id,
                             @RequestBody ReviewRequest request) {
        return aftersaleService.review(user, id, request);
    }

    @PostMapping("/tickets/{id}/warehouse")
    @RequireRole("warehouse")
    public TicketView warehouse(@RequestAttribute(AuthInterceptor.USER_ATTR) UserEntity user,
                                @PathVariable String id,
                                @RequestBody WarehouseRequest request) {
        if ("RECEIVE".equals(request.action())) {
            return aftersaleService.receive(user, id, request);
        }
        if ("INSPECT".equals(request.action())) {
            return aftersaleService.inspect(user, id, request);
        }
        throw ApiException.badRequest("未知仓库操作");
    }
}
