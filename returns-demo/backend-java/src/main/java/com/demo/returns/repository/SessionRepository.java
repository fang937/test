package com.demo.returns.repository;

import com.demo.returns.entity.SessionEntity;
import com.demo.returns.entity.UserEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface SessionRepository extends JpaRepository<SessionEntity, String> {

    @Query("select s.user from SessionEntity s where s.token = :token")
    Optional<UserEntity> findUserByToken(@Param("token") String token);
}
