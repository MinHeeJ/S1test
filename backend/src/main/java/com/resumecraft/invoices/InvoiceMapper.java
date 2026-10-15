package com.resumecraft.invoices;

import com.resumecraft.resumes.ResumeAccount;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

/** Owner-scoped XML persistence; generated identities are returned directly from INSERT. */
@Mapper
public interface InvoiceMapper {
    ResumeAccount account(@Param("identity") String identity);
    List<InvoiceRow> list(@Param("userId") Long userId, @Param("type") String type, @Param("offset") long offset);
    long count(@Param("userId") Long userId, @Param("type") String type);
    InvoiceRow find(@Param("id") Long id, @Param("userId") Long userId);
    InvoiceRow latest(@Param("userId") Long userId);
    int maxNumber(@Param("userId") Long userId, @Param("type") String type, @Param("prefix") String prefix);
    Long insert(@Param("userId") Long userId, @Param("type") String type, @Param("number") String number,
            @Param("sourceId") Long sourceId, @Param("title") String title, @Param("content") String content,
            @Param("amounts") InvoiceCalculator.Amounts amounts);
    int save(@Param("id") Long id, @Param("userId") Long userId, @Param("write") InvoiceWrite write,
            @Param("content") String content, @Param("amounts") InvoiceCalculator.Amounts amounts);
    int delete(@Param("id") Long id, @Param("userId") Long userId);
    boolean ownsPhoto(@Param("photoId") String photoId, @Param("userId") Long userId);
}
