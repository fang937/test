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

/** 图片凭证（演示：仅记录模拟文件名） */
@Entity
@Table(name = "aftersale_images")
public class TicketImageEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "ticket_no", referencedColumnName = "ticket_no")
    private TicketEntity ticket;

    @Column(nullable = false, length = 200)
    private String filename;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    public TicketImageEntity() {}

    public TicketImageEntity(TicketEntity ticket, String filename, LocalDateTime createdAt) {
        this.ticket = ticket;
        this.filename = filename;
        this.createdAt = createdAt;
    }

    public String getFilename() { return filename; }
}
