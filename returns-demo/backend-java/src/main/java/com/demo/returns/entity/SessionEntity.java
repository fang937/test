package com.demo.returns.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

@Entity
@Table(name = "sessions")
public class SessionEntity {
    @Id
    @Column(length = 64)
    private String token;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id")
    private UserEntity user;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    public SessionEntity() {}

    public SessionEntity(String token, UserEntity user, LocalDateTime createdAt) {
        this.token = token;
        this.user = user;
        this.createdAt = createdAt;
    }

    public String getToken() { return token; }
    public UserEntity getUser() { return user; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
