FROM maven:3.9.9-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml ./
COPY src ./src
RUN mvn -B -DskipTests package

FROM eclipse-temurin:17.0.13_11-jre-jammy
RUN groupadd --system resumecraft && useradd --system --gid resumecraft resumecraft
WORKDIR /app
COPY --from=build --chown=resumecraft:resumecraft /app/target/resumecraft-1.0.0.jar /app/app.jar
USER resumecraft
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s CMD curl -fsS http://127.0.0.1:8080/api/health || exit 1
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
