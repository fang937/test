package com.demo.returns.controller;

import com.demo.returns.common.AuthInterceptor;
import com.demo.returns.common.RequireRole;
import com.demo.returns.dto.CreateTicketRequest;
import com.demo.returns.dto.SupplementRequest;
import com.demo.returns.dto.OrderView;
import com.demo.returns.dto.TicketView;
import com.demo.returns.entity.UserEntity;
import com.demo.returns.service.AftersaleService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** 消费者接口 */
@RestController
@RequestMapping("/api")
@RequireRole("consumer")
public class ConsumerController {

    private final AftersaleService aftersaleService;

    public ConsumerController(AftersaleService aftersaleService) {
        this.aftersaleService = aftersaleService;
    }

    @GetMapping("/me/orders")
    public List<OrderView> myOrders(@RequestAttribute(AuthInterceptor.USER_ATTR) UserEntity user) {
        return aftersaleService.myOrders(user);
    }

    @PostMapping("/tickets")
    public TicketView createTicket(@RequestAttribute(AuthInterceptor.USER_ATTR) UserEntity user,
                                   @RequestBody CreateTicketRequest request) {
        return aftersaleService.createTicket(user, request);
    }

    @GetMapping("/my/tickets")
    public List<TicketView> myTickets(@RequestAttribute(AuthInterceptor.USER_ATTR) UserEntity user) {
        return aftersaleService.listMyTickets(user);
    }

    @PostMapping("/tickets/{id}/supplement")
    public TicketView supplement(@RequestAttribute(AuthInterceptor.USER_ATTR) UserEntity user,
                                 @PathVariable String id,
                                 @RequestBody SupplementRequest request) {
        return aftersaleService.supplementTicket(user, id, request);
    }
}
