package com.resumecraft.common;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.resumecraft.common.persistence.JsonNodeTypeHandler;
import com.resumecraft.common.persistence.UuidTypeHandler;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Types;
import java.util.Map;
import java.util.UUID;
import org.apache.ibatis.builder.xml.XMLMapperBuilder;
import org.apache.ibatis.session.Configuration;
import org.apache.ibatis.type.JdbcType;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class MapperContractTest {
    private Configuration configuration() throws Exception {
        var config = new Configuration();
        for (String name : new String[] {"User", "Resume", "Photo"}) {
            String resource = "mybatis/" + name + "Mapper.xml";
            try (var input = new ClassPathResource(resource).getInputStream()) {
                new XMLMapperBuilder(input, config, resource, config.getSqlFragments()).parse();
            }
        }
        return config;
    }

    @Test
    void allStatementsAndRecordConstructorsResolveWithoutDatabase() throws Exception {
        var config = configuration();
        assertThat(config.getResultMap("com.resumecraft.common.persistence.ResumeMapper.row")
            .getConstructorResultMappings()).hasSize(9);
        assertThat(config.hasStatement("com.resumecraft.common.persistence.PhotoMapper.findOwned")).isTrue();
        assertThat(config.hasStatement("com.resumecraft.common.persistence.UserMapper.insert")).isTrue();
    }

    @Test
    void omittedPutTitleDoesNotCreateNullBindingPredicate() throws Exception {
        var config = configuration();
        var args = new java.util.HashMap<String, Object>();
        args.put("title", null);
        var sql = config.getMappedStatement("com.resumecraft.common.persistence.ResumeMapper.updateOwned")
            .getBoundSql(args).getSql();
        assertThat(sql).contains("user_id =", "deleted = FALSE").doesNotContain("title =", "IS NULL");
        args.put("title", "이름 변경");
        assertThat(config.getMappedStatement("com.resumecraft.common.persistence.ResumeMapper.updateOwned")
            .getBoundSql(args).getSql()).contains("title =");
    }

    @Test
    void jsonHandlerPreservesHiddenDataAndInvalidDisplayDate() throws Exception {
        var json = new ObjectMapper().readTree("""
            [{"type":"experience","hidden":true,"items":[{"start":"bad-date","current":true}]}]
            """);
        var statement = mock(PreparedStatement.class);
        var handler = new JsonNodeTypeHandler();
        handler.setNonNullParameter(statement, 1, json, JdbcType.OTHER);
        verify(statement).setObject(1, json.toString(), Types.OTHER);
        var result = mock(ResultSet.class);
        when(result.getString("content")).thenReturn(json.toString());
        assertThat(handler.getNullableResult(result, "content")).isEqualTo(json);
        when(result.getString("content")).thenReturn(null);
        assertThat(handler.getNullableResult(result, "content")).isNull();
    }

    @Test
    void uuidHandlerUsesNativeUuidBinding() throws Exception {
        var id = UUID.randomUUID();
        var statement = mock(PreparedStatement.class);
        var handler = new UuidTypeHandler();
        handler.setNonNullParameter(statement, 2, id, JdbcType.OTHER);
        verify(statement).setObject(2, id);
        var result = mock(ResultSet.class);
        when(result.getObject("id", UUID.class)).thenReturn(id);
        assertThat(handler.getNullableResult(result, "id")).isEqualTo(id);
    }
}
