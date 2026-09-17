package com.demo.returns.repository;

import com.demo.returns.entity.OrderEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface OrderRepository extends JpaRepository<OrderEntity, Long> {

    List<OrderEntity> findByUser_IdAndStatusOrderByIdAsc(String userId, String status);
}
