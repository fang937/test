package com.demo.returns.repository;

import com.demo.returns.entity.OrderItemEntity;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface OrderItemRepository extends JpaRepository<OrderItemEntity, Long> {

    List<OrderItemEntity> findByOrder_IdOrderByIdAsc(Long orderId);

    Optional<OrderItemEntity> findByOrder_OrderNoAndItemId(String orderNo, String itemId);

    /** 事务内锁住商品行（SELECT ... FOR UPDATE），防止并发超量申请 */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select i from OrderItemEntity i where i.order.orderNo = :orderNo and i.itemId = :itemId")
    Optional<OrderItemEntity> lockByOrderNoAndItemId(@Param("orderNo") String orderNo,
                                                     @Param("itemId") String itemId);
}
