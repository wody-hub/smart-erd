package com.smarterd.domain.diagram.service;

import com.smarterd.config.websocket.WebSocketProperties;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import lombok.extern.slf4j.Slf4j;

/**
 * Y.Doc snapshot service의 SmartLifecycle 동작을 담당한다.
 */
@Slf4j
final class DiagramSnapshotLifecycleSupport {

    private final WebSocketProperties webSocketProperties;
    private final DiagramSnapshotFlushSupport flushSupport;
    private final DiagramSnapshotCompactionSupport compactionSupport;
    private volatile boolean running = false;

    /**
     * @param webSocketProperties WebSocket 설정 프로퍼티
     * @param flushSupport snapshot flush 지원 객체
     * @param compactionSupport snapshot 컴팩션 지원 객체
     */
    DiagramSnapshotLifecycleSupport(
        WebSocketProperties webSocketProperties,
        DiagramSnapshotFlushSupport flushSupport,
        DiagramSnapshotCompactionSupport compactionSupport
    ) {
        this.webSocketProperties = webSocketProperties;
        this.flushSupport = flushSupport;
        this.compactionSupport = compactionSupport;
    }

    /**
     * 서버 종료 시 모든 dirty 다이어그램 및 인메모리 누적 update를 DB에 저장한다.
     */
    void stop() {
        log.info("서버 종료: 인메모리 Y.Doc 스냅샷 일괄 flush 시작");
        final var result = flushSupport.flushAllOnShutdown();
        if (!result.hasFlushTargets()) {
            log.info("서버 종료: flush할 다이어그램 없음");
            running = false;
            return;
        }

        log.info("서버 종료: Y.Doc 스냅샷 일괄 flush 완료 ({}개 저장)", result.savedCount());
        compactionSupport.clearAllCoolDowns();
        running = false;
    }

    /**
     * lifecycle running 상태를 시작으로 변경한다.
     */
    void start() {
        running = true;
    }

    /**
     * lifecycle running 상태를 반환한다.
     *
     * @return 실행 중이면 true
     */
    boolean isRunning() {
        return running;
    }

    /**
     * 종료 단계를 반환한다.
     *
     * @return 종료 단계
     */
    int getPhase() {
        return Integer.MAX_VALUE - 1;
    }

    /**
     * 비동기 종료 콜백을 수행한다.
     *
     * @param callback 종료 완료 콜백
     */
    void stop(Runnable callback) {
        final var executor = Executors.newSingleThreadExecutor();
        executor.submit(() -> {
            try {
                this.stop();
            } catch (Exception e) {
                log.error("서버 종료: Y.Doc flush 중 예외 발생", e);
            }
        });
        executor.shutdown();
        waitForShutdownFlush(executor, callback);
    }

    /**
     * 종료 flush 완료를 기다리고 콜백을 실행한다.
     *
     * @param executor 종료 flush executor
     * @param callback 종료 완료 콜백
     */
    private void waitForShutdownFlush(java.util.concurrent.ExecutorService executor, Runnable callback) {
        try {
            final var shutdownFlushTimeoutMillis = webSocketProperties.getShutdownFlushTimeoutMillis();
            if (!executor.awaitTermination(shutdownFlushTimeoutMillis, TimeUnit.MILLISECONDS)) {
                log.warn(
                    "서버 종료: Y.Doc flush 타임아웃 ({}ms) 초과, 미저장 update가 유실될 수 있음",
                    shutdownFlushTimeoutMillis
                );
                executor.shutdownNow();
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.warn("서버 종료: Y.Doc flush 중 인터럽트 발생");
        } finally {
            callback.run();
        }
    }
}
