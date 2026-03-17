package com.smarterd.utils.excel;

import java.io.Serial;

/**
 * 엑셀 처리 중 발생하는 런타임 예외.
 */
public class ExcelException extends RuntimeException {

    @Serial
    private static final long serialVersionUID = 1L;

    /**
     * @param message 오류 메시지
     */
    public ExcelException(String message) {
        super(message);
    }
}
