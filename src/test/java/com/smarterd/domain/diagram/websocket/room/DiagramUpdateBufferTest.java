package com.smarterd.domain.diagram.websocket.room;

import static org.assertj.core.api.Assertions.assertThat;

import com.smarterd.domain.diagram.websocket.protocol.YjsUpdateFormat;
import java.lang.reflect.Field;
import java.util.List;
import java.util.Map;
import java.util.Queue;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class DiagramUpdateBufferTest {

    @Test
    @DisplayName("appendUpdate/drainAndMergeUpdates 동시 실행 후에도 sizeCounter와 리스트 크기가 일치한다")
    void appendAndDrain_concurrent_keepsSizeCounterConsistent() throws Exception {
        final var buffer = new DiagramUpdateBuffer();
        final var diagramId = 1L;
        final long maxBufferBytes = 10_000_000L;

        final int appenderThreads = 4;
        final int drainerThreads = 2;
        final int appendLoopsPerThread = 2_000;
        final int drainLoopsPerThread = 1_000;

        final var errors = new ConcurrentLinkedQueue<Throwable>();
        final var start = new CountDownLatch(1);
        final var pool = Executors.newFixedThreadPool(appenderThreads + drainerThreads);

        for (int i = 0; i < appenderThreads; i++) {
            pool.execute(() -> runAppender(buffer, diagramId, maxBufferBytes, appendLoopsPerThread, start, errors));
        }
        for (int i = 0; i < drainerThreads; i++) {
            pool.execute(() -> runDrainer(buffer, diagramId, drainLoopsPerThread, start, errors));
        }

        start.countDown();
        pool.shutdown();
        final var finished = pool.awaitTermination(15, TimeUnit.SECONDS);

        assertThat(finished).isTrue();
        assertThat(errors).isEmpty();

        assertCounterMatchesActualSize(buffer, diagramId);

        // 마지막 drain 이후에도 카운터/리스트 일관성이 유지되는지 재확인
        final var drained = buffer.drainAndMergeUpdates(diagramId);
        if (drained.length > 0) {
            YjsUpdateFormat.decode(drained);
        }
        assertCounterMatchesActualSize(buffer, diagramId);
    }

    @Test
    @DisplayName("restoreUpdates - 버퍼 상한을 넘더라도 복원 경로에서는 데이터를 유지한다")
    void restoreUpdates_exceedsBufferLimit_stillRestoresForDurability() throws Exception {
        final var buffer = new DiagramUpdateBuffer();
        final var diagramId = 7L;
        final long maxBufferBytes = 10L;
        final var existing = new byte[6];
        final var restore1 = new byte[] { 1, 2, 3 };
        final var restore2 = new byte[] { 4, 5, 6 };
        final var mergedRestore = YjsUpdateFormat.encode(List.of(restore1, restore2));

        final var appended = buffer.appendUpdate(diagramId, existing, maxBufferBytes);
        assertThat(appended).isTrue();

        final var restored = buffer.restoreUpdates(diagramId, mergedRestore, maxBufferBytes);

        assertThat(restored).isTrue();
        final var drained = buffer.drainAndMergeUpdates(diagramId);
        final var decoded = YjsUpdateFormat.decode(drained);
        assertThat(decoded).hasSize(3);
        assertThat(decoded.get(0)).isEqualTo(existing);
        assertThat(decoded.get(1)).isEqualTo(restore1);
        assertThat(decoded.get(2)).isEqualTo(restore2);
        assertCounterMatchesActualSize(buffer, diagramId);
    }

    @Test
    @DisplayName("restoreUpdates - 복원 성공 시 dirty 상태로 표시된다")
    void restoreUpdates_success_marksDirtyDiagram() {
        final var buffer = new DiagramUpdateBuffer();
        final var diagramId = 8L;
        final long maxBufferBytes = 100L;
        final var mergedRestore = YjsUpdateFormat.encode(List.of(new byte[] { 9, 9, 9 }));

        final var restored = buffer.restoreUpdates(diagramId, mergedRestore, maxBufferBytes);

        assertThat(restored).isTrue();
        assertThat(buffer.getDirtyIdsAndClear()).contains(diagramId);
    }

    private void runAppender(
        DiagramUpdateBuffer buffer,
        Long diagramId,
        long maxBufferBytes,
        int loops,
        CountDownLatch start,
        Queue<Throwable> errors
    ) {
        try {
            start.await();
            for (int i = 0; i < loops; i++) {
                buffer.appendUpdate(diagramId, new byte[64], maxBufferBytes);
            }
        } catch (Throwable t) {
            errors.add(t);
        }
    }

    private void runDrainer(
        DiagramUpdateBuffer buffer,
        Long diagramId,
        int loops,
        CountDownLatch start,
        Queue<Throwable> errors
    ) {
        try {
            start.await();
            for (int i = 0; i < loops; i++) {
                final var drained = buffer.drainAndMergeUpdates(diagramId);
                if (drained.length > 0) {
                    YjsUpdateFormat.decode(drained);
                }
            }
        } catch (Throwable t) {
            errors.add(t);
        }
    }

    private void assertCounterMatchesActualSize(DiagramUpdateBuffer buffer, Long diagramId) throws Exception {
        final var updatesByDiagram = accumulatedUpdates(buffer);
        final var sizesByDiagram = accumulatedSizes(buffer);

        final var updates = updatesByDiagram.get(diagramId);
        final var counter = sizesByDiagram.get(diagramId);

        if (updates == null) {
            final var size = counter == null ? 0L : counter.get();
            assertThat(size).isZero();
            return;
        }

        long actualSize = 0;
        synchronized (updates) {
            for (final var update : updates) {
                actualSize += update.length;
            }
        }

        final var counterValue = counter == null ? 0L : counter.get();
        assertThat(counterValue).isEqualTo(actualSize);
    }

    @SuppressWarnings("unchecked")
    private Map<Long, List<byte[]>> accumulatedUpdates(DiagramUpdateBuffer buffer) throws Exception {
        final Field field = DiagramUpdateBuffer.class.getDeclaredField("accumulatedUpdates");
        field.setAccessible(true);
        return (Map<Long, List<byte[]>>) field.get(buffer);
    }

    @SuppressWarnings("unchecked")
    private Map<Long, AtomicLong> accumulatedSizes(DiagramUpdateBuffer buffer) throws Exception {
        final Field field = DiagramUpdateBuffer.class.getDeclaredField("accumulatedSizes");
        field.setAccessible(true);
        return (Map<Long, AtomicLong>) field.get(buffer);
    }
}
