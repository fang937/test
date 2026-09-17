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

/** 订单商品；itemId 为对外编号（如 i1），aftersalableQty 为可售后上限 */
@Entity
@Table(name = "order_items")
public class OrderItemEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "order_id")
    private OrderEntity order;

    @Column(name = "item_id", nullable = false, length = 20)
    private String itemId;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false)
    private int price;

    @Column(nullable = false)
    private int qty;

    @Column(name = "aftersalable_qty", nullable = false)
    private int aftersalableQty;

    public OrderItemEntity() {}

    public OrderItemEntity(OrderEntity order, String itemId, String name, int price, int qty, int aftersalableQty) {
        this.order = order;
        this.itemId = itemId;
        this.name = name;
        this.price = price;
        this.qty = qty;
        this.aftersalableQty = aftersalableQty;
    }

    public Long getId() { return id; }
    public OrderEntity getOrder() { return order; }
    public String getItemId() { return itemId; }
    public String getName() { return name; }
    public int getPrice() { return price; }
    public int getQty() { return qty; }
    public int getAftersalableQty() { return aftersalableQty; }
}
