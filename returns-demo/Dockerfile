# 构建阶段：Maven + JDK；前端由 pom 的 copy-frontend 从 ../public 自动带入
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /build
# 先复制 pom 下载依赖，利用 Docker 层缓存加速后续构建
COPY backend-java/pom.xml pom.xml
RUN mvn -q -B dependency:go-offline || true
COPY backend-java/src src
COPY public ../public
RUN mvn -q -B -DskipTests package

# 运行阶段：仅 JRE
FROM eclipse-temurin:17-jre
WORKDIR /app
RUN mkdir -p /app/data /app/logs
COPY --from=build /build/target/returns-backend-1.0.0.jar app.jar
ENV TZ=Asia/Shanghai \
    H2_FILE=/app/data/aftersale
EXPOSE 3000
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
