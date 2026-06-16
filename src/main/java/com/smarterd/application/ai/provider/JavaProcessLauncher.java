package com.smarterd.application.ai.provider;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Java {@link ProcessBuilder}-based process launcher.
 */
public class JavaProcessLauncher implements ProcessLauncher {

    private final Map<String, RunningProcess> runningProcesses = new ConcurrentHashMap<>();

    @Override
    public Result launch(LaunchRequest request) {
        final var processBuilder = new ProcessBuilder(request.command()).directory(request.cwd().toFile());
        final var environment = processBuilder.environment();
        environment.clear();
        request.environment().forEach(environment::put);

        Process process;
        try {
            process = processBuilder.start();
        } catch (IOException ex) {
            return new Result(127, "", "", false, false);
        }

        final var cancelled = new AtomicBoolean(false);
        runningProcesses.put(request.executionId(), new RunningProcess(process, cancelled));
        final var outputReaders = Executors.newFixedThreadPool(2);
        final var stdout = outputReaders.submit(() -> readStream(process.getInputStream()));
        final var stderr = outputReaders.submit(() -> readStream(process.getErrorStream()));
        try {
            try (var stdin = process.getOutputStream()) {
                stdin.write(request.stdin().getBytes(StandardCharsets.UTF_8));
            }

            final var finished = process.waitFor(request.timeout().toMillis(), TimeUnit.MILLISECONDS);
            if (!finished) {
                process.destroyForcibly();
                return new Result(124, output(stdout), output(stderr), true, false);
            }
            return new Result(process.exitValue(), output(stdout), output(stderr), false, cancelled.get());
        } catch (IOException ex) {
            return new Result(1, output(stdout), output(stderr), false, cancelled.get());
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            process.destroyForcibly();
            return new Result(130, output(stdout), output(stderr), false, cancelled.get());
        } finally {
            outputReaders.shutdownNow();
            runningProcesses.remove(request.executionId());
        }
    }

    @Override
    public void cancel(String executionId) {
        final var runningProcess = runningProcesses.get(executionId);
        if (runningProcess == null) {
            return;
        }
        runningProcess.cancelled().set(true);
        runningProcess.process().destroy();
    }

    /**
     * Reads one process stream fully as UTF-8 text.
     *
     * @param stream process output stream
     * @return stream contents
     * @throws IOException when stream reading fails
     */
    private String readStream(InputStream stream) throws IOException {
        try (stream) {
            return new String(stream.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    /**
     * Returns collected stream output without letting cleanup block indefinitely.
     *
     * @param future stream reader future
     * @return collected output or empty string on failure
     */
    private String output(Future<String> future) {
        try {
            return future.get(1, TimeUnit.SECONDS);
        } catch (ExecutionException | TimeoutException ex) {
            return "";
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            return "";
        }
    }

    private record RunningProcess(Process process, AtomicBoolean cancelled) {}
}
