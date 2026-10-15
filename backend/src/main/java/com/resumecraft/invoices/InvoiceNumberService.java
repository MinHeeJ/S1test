package com.resumecraft.invoices;

import com.resumecraft.common.DomainException;
import java.sql.SQLException;
import java.time.Year;
import java.time.ZoneId;
import java.util.function.Function;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

/** Each numbering attempt is a fresh transaction; only the document-number constraint is retried. */
@Service
public class InvoiceNumberService {
    private final InvoiceMapper mapper;
    private final TransactionTemplate transactions;

    public InvoiceNumberService(InvoiceMapper mapper, PlatformTransactionManager manager) {
        this.mapper = mapper;
        transactions = new TransactionTemplate(manager);
        transactions.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    public Long create(Long userId, String type, Function<String, Long> insert) {
        String prefix = (type.equals("quote") ? "Q-" : "I-") + Year.now(ZoneId.of("Asia/Seoul")) + "-";
        for (int attempt = 0; attempt < 2; attempt++) {
            try {
                return transactions.execute(status -> {
                    int max = mapper.maxNumber(userId, type, prefix);
                    if (max >= 9999) throw conflict("DOCUMENT_NUMBER_EXHAUSTED");
                    return insert.apply(prefix + String.format(java.util.Locale.ROOT, "%04d", max + 1));
                });
            } catch (DuplicateKeyException e) {
                if (!numberConflict(e)) throw e;
                if (attempt == 1) throw conflict("DOCUMENT_NUMBER_CONFLICT");
            }
        }
        throw conflict("DOCUMENT_NUMBER_CONFLICT");
    }

    private boolean numberConflict(Throwable error) {
        for (Throwable cause = error; cause != null; cause = cause.getCause()) {
            if (cause instanceof SQLException sql && "23505".equals(sql.getSQLState())
                    && sql.getMessage().contains("invoice_user_id_doc_no_key")) return true;
        }
        return false;
    }

    private DomainException conflict(String code) {
        return new DomainException(HttpStatus.CONFLICT, code, "문서번호를 발급하지 못했습니다.", null);
    }
}
