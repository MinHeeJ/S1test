package com.resumecraft.photos;

import java.util.UUID;
import org.apache.ibatis.builder.xml.XMLMapperBuilder;
import org.apache.ibatis.session.Configuration;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import static org.assertj.core.api.Assertions.assertThat;

class PhotoMapperTest {
    @Test
    void xmlConstructorMappingMatchesNativeUuidAndPrimitiveBytes() throws Exception {
        String resource = "mappers/photos/PhotoMapper.xml";
        Configuration config = new Configuration();
        try (var stream = new ClassPathResource(resource).getInputStream()) {
            new XMLMapperBuilder(stream, config, resource, config.getSqlFragments()).parse();
        }
        var arguments = config.getResultMap("com.resumecraft.photos.PhotoMapper.photoRow")
            .getConstructorResultMappings();
        assertThat(arguments.stream().map(argument -> argument.getJavaType()).toList())
            .isEqualTo(java.util.List.of(UUID.class, UUID.class, String.class, byte[].class));
        assertThat(Photo.class.getDeclaredConstructor(UUID.class, UUID.class, String.class, byte[].class))
            .isNotNull();
        assertThat(config.hasStatement("com.resumecraft.photos.PhotoMapper.insert")).isTrue();
        assertThat(config.hasStatement("com.resumecraft.photos.PhotoMapper.findOwned")).isTrue();
    }
}
