package com.demo.returns.repository;

import com.demo.returns.entity.SessionEntity;
import com.demo.returns.entity.UserEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Optional;

public interface SessionRepository extends JpaRepository<SessionEntity, String> {

    /** 会话有效期；超时未活动的会话视为失效 */
    Duration SESSION_TTL = Duration.ofDays(7);

    /** 只返回仍在有效期内的会话对应的用户 */
    @Query("select s.user from SessionEntity s where s.token = :token and s.createdAt >= :since")
    Optional<UserEntity> findActiveUserByToken(@Param("token") String token,
                                               @Param("since") LocalDateTime since);

    /** 清理过期会话；需在事务内调用 */
    @Modifying
    @Query("delete from SessionEntity s where s.createdAt < :cutoff")
    int deleteExpiredBefore(@Param("cutoff") LocalDateTime cutoff);
}
