package com.demo.returns.repository;

import com.demo.returns.entity.TicketEventEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TicketEventRepository extends JpaRepository<TicketEventEntity, Long> {

    List<TicketEventEntity> findByTicket_TicketNoOrderByIdAsc(String ticketNo);
}
