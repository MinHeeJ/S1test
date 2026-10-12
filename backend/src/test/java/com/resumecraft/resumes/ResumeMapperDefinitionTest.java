package com.resumecraft.resumes;

import com.resumecraft.common.JsonbTypeHandler;
import com.resumecraft.common.UuidTypeHandler;
import org.apache.ibatis.builder.xml.XMLMapperBuilder;
import org.apache.ibatis.session.Configuration;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;

import static org.assertj.core.api.Assertions.assertThat;

/** Database-free mapper registration check; real row materialization is separately opt-in. */
class ResumeMapperDefinitionTest {
    @Test
    void durableXmlRegistersAllActualInterfaceStatementsAndTypedProjection() throws Exception {
        var configuration = new Configuration();
        configuration.getTypeHandlerRegistry().register(UuidTypeHandler.class);
        configuration.getTypeHandlerRegistry().register(JsonbTypeHandler.class);
        try (var input = new ClassPathResource("mappers/ResumeMapper.xml").getInputStream()) {
            new XMLMapperBuilder(input, configuration, "mappers/ResumeMapper.xml",
                configuration.getSqlFragments()).parse();
        }
        for (var method : ResumeMapper.class.getDeclaredMethods()) {
            assertThat(configuration.hasStatement(ResumeMapper.class.getName() + "." + method.getName())).isTrue();
        }
        assertThat(configuration.getResultMap(ResumeMapper.class.getName() + ".resume").getType())
            .isEqualTo(ResumeRecord.class);
        assertThat(configuration.getResultMap(ResumeMapper.class.getName() + ".resume").getConstructorResultMappings())
            .hasSize(6);
    }
}
