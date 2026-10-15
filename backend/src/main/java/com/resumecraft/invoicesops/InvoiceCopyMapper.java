package com.resumecraft.invoicesops;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

/** XML-backed copy commands share the invoice table without depending on CRUD implementation classes. */
@Mapper
public interface InvoiceCopyMapper {
    InvoiceCopyRow find(@Param("id") Long id, @Param("userId") Long userId);

    /** Includes deleted rows, so a retained document number can never be reused. */
    int maximum(@Param("userId") Long userId, @Param("docType") String docType, @Param("prefix") String prefix);

    /** INSERT RETURNING supplies the new identity without a scoped follow-up query. */
    Long insert(
            @Param("userId") Long userId,
            @Param("docType") String docType,
            @Param("docNo") String docNo,
            @Param("sourceQuoteId") Long sourceQuoteId,
            @Param("title") String title,
            @Param("content") String content,
            @Param("supply") Long supply,
            @Param("vat") Long vat,
            @Param("total") Long total
    );
}
