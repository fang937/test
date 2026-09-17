package com.demo.returns.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

/** 模拟订单；orderNo 为对外编号（如 O2026091001） */
@Entity
@Table(name = "orders")
public class OrderEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "order_no", nullable = false, unique = true, length = 20)
    private String orderNo;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id")
    private UserEntity user;

    @Column(nullable = false, length = 20)
    private String status; // 目前仅 COMPLETED 可申请售后

    @Column(nullable = false)
    private LocalDateTime createdAt;

    public OrderEntity() {}

    public OrderEntity(String orderNo, UserEntity user, String status, LocalDateTime createdAt) {
        this.orderNo = orderNo;
        this.user = user;
        this.status = status;
        this.createdAt = createdAt;
    }

    public Long getId() { return id; }
    public String getOrderNo() { return orderNo; }
    public UserEntity getUser() { return user; }
    public String getStatus() { return status; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
