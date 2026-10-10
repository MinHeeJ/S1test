FROM maven:3.9.9-eclipse-temurin-17 AS build
WORKDIR /workspace
COPY pom.xml ./
COPY src ./src
RUN mvn -B -DskipTests package

FROM eclipse-temurin:17.0.15_6-jre-alpine
RUN addgroup -S resume && adduser -S -G resume resume
WORKDIR /app
COPY --from=build --chown=resume:resume /workspace/target/resumecraft.jar /app/resumecraft.jar
USER resume
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=5s --start-period=40s --retries=6     CMD wget -q -O /dev/null http://127.0.0.1:8080/api/health || exit 1
ENTRYPOINT ["java", "-jar", "/app/resumecraft.jar"]
