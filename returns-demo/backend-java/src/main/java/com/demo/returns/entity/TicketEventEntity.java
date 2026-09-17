package com.demo.returns.entity;

import com.demo.returns.domain.Role;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

/** 时间线：每次状态变化记录操作人、岗位、动作与说明 */
@Entity
@Table(name = "aftersale_events")
public class TicketEventEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "ticket_no", referencedColumnName = "ticket_no")
    private TicketEntity ticket;

    @Column(name = "operator_name", nullable = false, length = 50)
    private String operatorName;

    @Enumerated(EnumType.STRING)
    @Column(name = "operator_role", nullable = false, length = 20)
    private Role operatorRole;

    @Column(nullable = false, length = 50)
    private String action;

    @Column(columnDefinition = "VARCHAR(1000)")
    private String note = "";

    @Column(nullable = false)
    private LocalDateTime createdAt;

    public TicketEventEntity() {}

    public TicketEventEntity(TicketEntity ticket, String operatorName, Role operatorRole,
                             String action, String note, LocalDateTime createdAt) {
        this.ticket = ticket;
        this.operatorName = operatorName;
        this.operatorRole = operatorRole;
        this.action = action;
        this.note = note == null ? "" : note;
        this.createdAt = createdAt;
    }

    public String getOperatorName() { return operatorName; }
    public Role getOperatorRole() { return operatorRole; }
    public String getAction() { return action; }
    public String getNote() { return note; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
