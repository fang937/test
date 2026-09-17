package com.demo.returns.service;

import com.demo.returns.common.PasswordUtil;
import com.demo.returns.domain.Role;
import com.demo.returns.entity.OrderEntity;
import com.demo.returns.entity.OrderItemEntity;
import com.demo.returns.entity.UserEntity;
import com.demo.returns.repository.OrderItemRepository;
import com.demo.returns.repository.OrderRepository;
import com.demo.returns.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/** 空库时写入演示账号与模拟订单（对应需求：数据库初始化数据和演示账号） */
@Component
public class SeedRunner implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(SeedRunner.class);

    private final UserRepository userRepository;
    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;

    public SeedRunner(UserRepository userRepository, OrderRepository orderRepository,
                      OrderItemRepository orderItemRepository) {
        this.userRepository = userRepository;
        this.orderRepository = orderRepository;
        this.orderItemRepository = orderItemRepository;
    }

    private record SeedUser(String id, String username, String password, String name, Role role) {}

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (userRepository.count() > 0) {
            return;
        }
        List<SeedUser> users = List.of(
                new SeedUser("u1", "xiaolin", "123456", "小林", Role.CONSUMER),
                new SeedUser("u2", "xiaomei", "123456", "小美", Role.CONSUMER),
                new SeedUser("u3", "kefu", "123456", "客服阿强", Role.SERVICE),
                new SeedUser("u4", "cangguan", "123456", "仓管老王", Role.WAREHOUSE));
        for (SeedUser u : users) {
            PasswordUtil.HashedPassword hashed = PasswordUtil.hash(u.password());
            userRepository.save(new UserEntity(u.id(), u.username(), hashed.hash(), hashed.salt(),
                    u.name(), u.role()));
        }

        UserEntity xiaolin = userRepository.getReferenceById("u1");
        UserEntity xiaomei = userRepository.getReferenceById("u2");

        OrderEntity order1 = orderRepository.save(new OrderEntity("O2026091001", xiaolin,
                "COMPLETED", LocalDateTime.of(2026, 9, 10, 10, 0, 0)));
        orderItemRepository.save(new OrderItemEntity(order1, "i1", "白色长袖衬衫（M码）", 129, 1, 1));
        orderItemRepository.save(new OrderItemEntity(order1, "i2", "白色长袖衬衫（L码）", 129, 1, 1));
        orderItemRepository.save(new OrderItemEntity(order1, "i3", "黑色休闲裤（30码）", 159, 2, 2));

        OrderEntity order2 = orderRepository.save(new OrderEntity("O2026090502", xiaomei,
                "COMPLETED", LocalDateTime.of(2026, 9, 5, 15, 30, 0)));
        orderItemRepository.save(new OrderItemEntity(order2, "i4", "牛仔外套", 259, 1, 1));

        log.info("已写入演示数据：4个演示账号（密码 123456）、2个模拟订单");
    }
}
