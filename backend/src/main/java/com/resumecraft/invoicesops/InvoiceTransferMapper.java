package com.resumecraft.invoicesops;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

/** Separate write adapter for snapshot copies; no existing invoice or photo is ever updated. */
@Mapper
public interface InvoiceTransferMapper {
    Long account(@Param("identity") String identity);
    InvoiceTransferRow find(@Param("id") Long id, @Param("userId") Long userId);
    Integer maximum(
            @Param("userId") Long userId,
            @Param("docType") String docType,
            @Param("prefix") String prefix
    );
    Long insert(InvoiceTransferInsert snapshot);
}
