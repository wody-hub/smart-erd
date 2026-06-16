package com.smarterd.domain.dictionary.service;

/**
 * 벌크 업로드 템플릿 유형.
 *
 * <p>메시지 코드 키와 가이드 항목 수를 캡슐화하여 타입 안전성을 보장한다.</p>
 */
enum BulkTemplateType {
    /** 도메인 템플릿 */
    DOMAIN("domain", "template.domain.sheet-name", 7, 7),

    /** 용어 템플릿 */
    TERM("term", "template.term.sheet-name", 8, 8),

    /** 단어 템플릿 */
    WORD("word", "template.word.sheet-name", 7, 7);

    private final String key;
    private final String sheetNameCode;
    private final int instructionCount;
    private final int maxRowsInstructionIndex;

    BulkTemplateType(String key, String sheetNameCode, int instructionCount, int maxRowsInstructionIndex) {
        this.key = key;
        this.sheetNameCode = sheetNameCode;
        this.instructionCount = instructionCount;
        this.maxRowsInstructionIndex = maxRowsInstructionIndex;
    }

    /**
     * @return 메시지 코드에 사용되는 키
     */
    public String key() {
        return key;
    }

    /**
     * @return 데이터 시트명 메시지 코드
     */
    public String sheetNameCode() {
        return sheetNameCode;
    }

    /**
     * @return 가이드 시트의 안내 항목 수
     */
    public int instructionCount() {
        return instructionCount;
    }

    /**
     * @param instructionIndex 안내 항목 번호
     * @return 업로드 최대 행 수 안내 항목이면 true
     */
    public boolean isMaxRowsInstruction(int instructionIndex) {
        return instructionIndex == maxRowsInstructionIndex;
    }
}
