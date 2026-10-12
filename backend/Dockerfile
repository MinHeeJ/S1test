FROM maven:3.9.9-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml ./
COPY src ./src
RUN mvn -B -DskipTests package

FROM eclipse-temurin:17.0.13_11-jre-jammy AS runtime
RUN groupadd --system resumecraft \
    && useradd --system --gid resumecraft --home /app resumecraft \
    && mkdir -p /app && chown resumecraft:resumecraft /app \
    && apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build --chown=resumecraft:resumecraft /app/target/resumecraft.jar ./resumecraft.jar
USER resumecraft
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=5s --start-period=60s --retries=10 \
    CMD curl -fsS http://127.0.0.1:8080/api/health >/dev/null || exit 1
ENTRYPOINT ["java", "-jar", "/app/resumecraft.jar"]
