package com.resumecraft.resumes;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

/** Contract-defined empty sections personalize basics from the persisted authenticated account. */
public final class ResumeDefaults {
    private ResumeDefaults() {}

    public static ArrayNode content(ObjectMapper json, ResumeAccount account) {
        ArrayNode result = json.createArrayNode();
        ObjectNode basics = result.addObject();
        basics.put("type", "basics").put("hidden", false);
        ObjectNode data = basics.putObject("data");
        data.put("name", account.nickname()).put("jobTitle", "").put("email", account.email()).put("phone", "");
        data.putArray("links");
        data.putNull("photoId");
        ObjectNode summary = result.addObject();
        summary.put("type", "summary").put("hidden", false);
        summary.putObject("data").put("headline", "").put("body", "");
        for (String type : new String[]{"experience", "education"}) {
            ObjectNode section = result.addObject();
            section.put("type", type).put("hidden", false);
            section.putArray("items");
        }
        ObjectNode skills = result.addObject();
        skills.put("type", "skills").put("hidden", false);
        skills.putObject("data").putArray("tags");
        return result;
    }
}
