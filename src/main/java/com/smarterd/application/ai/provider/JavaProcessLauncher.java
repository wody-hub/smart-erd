package com.smarterd.application.ai.provider;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
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
        try {
            process.getOutputStream().write(request.stdin().getBytes(StandardCharsets.UTF_8));
            process.getOutputStream().close();

            final var finished = process.waitFor(request.timeout().toMillis(), TimeUnit.MILLISECONDS);
            if (!finished) {
                process.destroyForcibly();
                return new Result(124, readStdout(process), "", true, false);
            }
            return new Result(process.exitValue(), readStdout(process), "", false, cancelled.get());
        } catch (IOException ex) {
            return new Result(1, "", "", false, cancelled.get());
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            process.destroyForcibly();
            return new Result(130, "", "", false, cancelled.get());
        } finally {
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

    private String readStdout(Process process) throws IOException {
        return new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
    }

    private record RunningProcess(Process process, AtomicBoolean cancelled) {}
}
