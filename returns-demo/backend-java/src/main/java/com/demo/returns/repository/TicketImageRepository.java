package com.demo.returns.repository;

import com.demo.returns.entity.TicketImageEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TicketImageRepository extends JpaRepository<TicketImageEntity, Long> {

    List<TicketImageEntity> findByTicket_TicketNoOrderByIdAsc(String ticketNo);
}
