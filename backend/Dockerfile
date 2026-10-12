FROM maven:3.9.9-eclipse-temurin-17 AS build
WORKDIR /workspace
COPY pom.xml ./
COPY src ./src
RUN mvn -B -DskipTests package

FROM eclipse-temurin:17.0.15_6-jre-jammy AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system resumecraft \
    && useradd --system --gid resumecraft --home-dir /app resumecraft
WORKDIR /app
COPY --from=build --chown=resumecraft:resumecraft /workspace/target/resumecraft-1.0.0.jar ./application.jar
USER resumecraft
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=5s --start-period=60s --retries=12 \
    CMD curl --fail --silent http://127.0.0.1:8080/api/health >/dev/null || exit 1
ENTRYPOINT ["java", "-jar", "application.jar"]
