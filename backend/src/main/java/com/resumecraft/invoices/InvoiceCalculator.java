package com.resumecraft.invoices;

import com.fasterxml.jackson.databind.JsonNode;

/** Integer-only monetary calculation shared by all invoice persistence commands. */
public final class InvoiceCalculator {
    private InvoiceCalculator() {}

    public record Amounts(long supply, long vat, long total) {}

    public static Amounts calculate(JsonNode content) {
        long sum = 0;
        for (JsonNode item : content.path("items")) {
            sum = Math.addExact(sum, Math.multiplyExact(item.path("qty").longValue(),
                    item.path("unitPrice").longValue()));
        }
        return switch (content.path("vatMode").asText()) {
            case "included" -> new Amounts(sum - sum / 11, sum / 11, sum);
            case "exempt" -> new Amounts(sum, 0, sum);
            default -> new Amounts(sum, sum / 10, sum + sum / 10);
        };
    }
}
