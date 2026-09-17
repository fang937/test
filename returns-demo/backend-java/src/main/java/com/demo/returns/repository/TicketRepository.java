package com.demo.returns.repository;

import com.demo.returns.domain.AftersaleStatus;
import com.demo.returns.domain.TicketType;
import com.demo.returns.entity.TicketEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface TicketRepository extends JpaRepository<TicketEntity, String> {

    Optional<TicketEntity> findByTicketNo(String ticketNo);

    @Query("select coalesce(max(t.seq), 0) from TicketEntity t")
    long findMaxSeq();

    /** 进行中的售后占用数量：排除已拒绝（及不存在的 CLOSED）状态 */
    @Query("""
            select coalesce(sum(t.qty), 0) from TicketEntity t
            where t.order.orderNo = :orderNo and t.item.itemId = :itemId
              and t.status <> :excluded
            """)
    long sumInFlightQty(@Param("orderNo") String orderNo,
                        @Param("itemId") String itemId,
                        @Param("excluded") AftersaleStatus excluded);

    List<TicketEntity> findAllByOrderBySeqDesc();

    List<TicketEntity> findAllByStatusOrderBySeqDesc(AftersaleStatus status);

    List<TicketEntity> findAllByTypeOrderBySeqDesc(TicketType type);

    List<TicketEntity> findAllByStatusAndTypeOrderBySeqDesc(AftersaleStatus status, TicketType type);

    List<TicketEntity> findAllByUser_IdOrderBySeqDesc(String userId);
}
