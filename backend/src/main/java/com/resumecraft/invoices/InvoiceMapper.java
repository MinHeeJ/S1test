package com.resumecraft.invoices;

import com.resumecraft.resumes.ResumeAccount;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

/** Owner/live predicates protect every read and mutation; numbering deliberately includes deleted rows. */
@Mapper
public interface InvoiceMapper {
    ResumeAccount account(@Param("identity") String identity);
    List<InvoiceRow> list(@Param("userId") Long userId, @Param("type") String type, @Param("offset") long offset);
    long count(@Param("userId") Long userId, @Param("type") String type);
    InvoiceRow find(@Param("id") Long id, @Param("userId") Long userId);
    InvoiceRow latest(@Param("userId") Long userId);
    int maximum(@Param("userId") Long userId, @Param("prefix") String prefix);
    Long insert(
            @Param("userId") Long userId, @Param("type") String type, @Param("number") String number,
            @Param("sourceQuoteId") Long sourceQuoteId, @Param("title") String title,
            @Param("content") String content, @Param("supply") long supply,
            @Param("vat") long vat, @Param("total") long total
    );
    int save(
            @Param("id") Long id, @Param("userId") Long userId, @Param("title") String title,
            @Param("content") String content, @Param("paid") boolean paid,
            @Param("supply") long supply, @Param("vat") long vat, @Param("total") long total
    );
    int delete(@Param("id") Long id, @Param("userId") Long userId);
    boolean ownsPhoto(@Param("photoId") String photoId, @Param("userId") Long userId);
}
