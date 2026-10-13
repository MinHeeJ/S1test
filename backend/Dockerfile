FROM maven:3.9.9-eclipse-temurin-17 AS build
WORKDIR /workspace
COPY pom.xml ./
COPY src ./src
RUN mvn -B -DskipTests package

FROM eclipse-temurin:17.0.13_11-jre-jammy AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 10001 resumecraft \
    && useradd --uid 10001 --gid resumecraft --create-home resumecraft
WORKDIR /app
COPY --from=build --chown=resumecraft:resumecraft /workspace/target/resumecraft-1.0.0.jar ./app.jar
COPY --chown=resumecraft:resumecraft src/main/resources/container-start.sh ./container-start.sh
USER resumecraft
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=6s --start-period=60s \
    CMD curl -fsS http://127.0.0.1:8080/api/health || exit 1
ENTRYPOINT ["sh", "/app/container-start.sh"]
