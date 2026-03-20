package com.smarterd.domain.diagram.websocket.protocol;

import java.nio.ByteBuffer;
import java.util.ArrayList;
import java.util.List;

/**
 * Yjs update 바이트 배열의 직렬화/역직렬화 포맷.
 *
 * <p>여러 개의 개별 Yjs update를 하나의 바이트 배열로 저장하기 위한 length-prefixed 포맷을 정의한다.
 * 단순 바이트 연결(concatenation)은 {@code Y.applyUpdate()}가 첫 번째 update만 파싱하고
 * 나머지를 무시하므로, 각 update 앞에 4바이트 big-endian 길이를 붙여 개별 update를 구분한다.</p>
 *
 * <p>포맷 구조:
 * <pre>
 * [4-byte magic: 0x594C5046] [4-byte len1] [update1 bytes] [4-byte len2] [update2 bytes] ...
 * </pre></p>
 *
 * <p>레거시 포맷(magic header 없음)은 단일 raw Yjs update로 간주하여 하위 호환성을 유지한다.</p>
 */
public final class YjsUpdateFormat {

    /** 포맷 식별 매직 바이트 ("YLPF" = Yjs Length Prefixed Format) */
    static final byte[] FORMAT_MAGIC = { 0x59, 0x4C, 0x50, 0x46 };

    /**
     * 유틸리티 클래스 인스턴스화를 방지한다.
     */
    private YjsUpdateFormat() {}

    /**
     * 여러 Yjs update를 length-prefixed 포맷으로 인코딩한다.
     *
     * @param updates 개별 Yjs update 바이트 배열 리스트
     * @return 매직 헤더 + length-prefixed entries 바이트 배열, 빈 리스트이면 빈 배열
     */
    public static byte[] encode(List<byte[]> updates) {
        if (updates.isEmpty()) {
            return new byte[0];
        }

        var totalLength = FORMAT_MAGIC.length;
        for (final var update : updates) {
            totalLength += 4 + update.length;
        }

        final var buffer = ByteBuffer.allocate(totalLength);
        buffer.put(FORMAT_MAGIC);
        for (final var update : updates) {
            buffer.putInt(update.length);
            buffer.put(update);
        }
        return buffer.array();
    }

    /**
     * length-prefixed 포맷을 디코딩하여 개별 Yjs update 리스트로 반환한다.
     * 레거시 포맷(magic 없음)은 전체를 단일 Yjs update로 간주한다.
     *
     * @param blob 인코딩된 바이트 배열
     * @return 개별 Yjs update 바이트 배열 리스트
     */
    public static List<byte[]> decode(byte[] blob) {
        if (blob == null || blob.length == 0) {
            return List.of();
        }

        if (hasMagic(blob)) {
            return decodeLengthPrefixed(blob);
        }

        // 레거시 포맷: 전체를 단일 Yjs update로 취급
        return List.of(blob);
    }

    /**
     * 매직 헤더 존재 여부를 확인한다.
     *
     * @param blob 확인할 바이트 배열
     * @return 매직 헤더 존재 여부
     */
    private static boolean hasMagic(byte[] blob) {
        if (blob.length < FORMAT_MAGIC.length) {
            return false;
        }
        for (var i = 0; i < FORMAT_MAGIC.length; i++) {
            if (blob[i] != FORMAT_MAGIC[i]) {
                return false;
            }
        }
        return true;
    }

    /**
     * length-prefixed entries를 파싱한다.
     *
     * @param blob 매직 헤더 포함 바이트 배열
     * @return 개별 Yjs update 바이트 배열 리스트
     */
    private static List<byte[]> decodeLengthPrefixed(byte[] blob) {
        final var buffer = ByteBuffer.wrap(blob);
        buffer.position(FORMAT_MAGIC.length);

        final var updates = new ArrayList<byte[]>();
        while (buffer.remaining() >= 4) {
            final var length = buffer.getInt();
            if (length <= 0 || length > buffer.remaining()) {
                break;
            }
            final var update = new byte[length];
            buffer.get(update);
            updates.add(update);
        }
        return updates;
    }
}
