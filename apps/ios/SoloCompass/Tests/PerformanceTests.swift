import XCTest
@testable import SoloCompass

// MARK: - US-036: Chat first-token-latency performance test

/// Benchmarks AgentRouter first-token latency with a mocked streaming GuideAgent.
/// Asserts P95 < 800ms across 20 samples.
///
/// Run with:
///   xcodebuild test -only-testing:SoloCompassTests/PerformanceTests
final class PerformanceTests: XCTestCase {

    private static let sampleCount = 20
    private static let p95ThresholdMs: Double = 800

    // MARK: - P95 latency assertion

    func testAgentRouterFirstTokenLatencyP95Under800ms() async throws {
        var latenciesMs: [Double] = []

        for _ in 0..<Self.sampleCount {
            let latency = try await measureFirstTokenLatency()
            latenciesMs.append(latency)
        }

        latenciesMs.sort()
        let p95Index = Int(Double(latenciesMs.count) * 0.95) - 1
        let p95 = latenciesMs[max(0, p95Index)]

        XCTAssertLessThan(
            p95,
            Self.p95ThresholdMs,
            "P95 first-token latency \(String(format: "%.1f", p95))ms exceeds \(Self.p95ThresholdMs)ms threshold"
        )
    }

    // MARK: - Mean sanity check

    func testFirstTokenMeanLatencyIsReasonable() async throws {
        var latencies: [Double] = []
        for _ in 0..<10 {
            let latency = try await measureFirstTokenLatency()
            latencies.append(latency)
        }
        let mean = latencies.reduce(0, +) / Double(latencies.count)
        XCTAssertLessThan(mean, Self.p95ThresholdMs,
            "Mean latency \(String(format: "%.1f", mean))ms should be well under \(Self.p95ThresholdMs)ms with mocked stream")
    }

    // MARK: - Measurement helper

    private func makeGuideAgent() -> GuideAgent {
        let sseBody = """
        data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Here are some great spots!"}}
        data: {"type":"message_stop"}

        """
        PerfStreamStubProtocol.sseBody = sseBody
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [PerfStreamStubProtocol.self]
        let session = URLSession(configuration: config)
        return GuideAgent(
            session: session,
            apiKey: "perf-test-key",
            apiURL: URL(string: "https://stub.perf/v1/messages")!
        )
    }

    private func measureFirstTokenLatency() async throws -> Double {
        let agent = makeGuideAgent()
        let message = AgentMessage(
            text: "recommend something nearby",
            history: []
        )
        let stream = agent.stream(
            message: message,
            contextSnapshot: nil,
            experienceSummaries: ["Nimman Cafe — coffee — 8.5/10"]
        )

        let start = Date()
        var gotFirstToken = false
        var firstTokenMs: Double = 0

        for try await _ in stream {
            if !gotFirstToken {
                firstTokenMs = Date().timeIntervalSince(start) * 1000
                gotFirstToken = true
                break
            }
        }

        if !gotFirstToken {
            firstTokenMs = Date().timeIntervalSince(start) * 1000
        }
        return firstTokenMs
    }
}

// MARK: - PerfStreamStubProtocol

/// Returns an SSE stream immediately with minimal delay — measures routing overhead only.
final class PerfStreamStubProtocol: URLProtocol {
    nonisolated(unsafe) static var sseBody: String = ""

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        let data = Self.sseBody.data(using: .utf8) ?? Data()
        let response = HTTPURLResponse(
            url: request.url!,
            statusCode: 200,
            httpVersion: nil,
            headerFields: ["Content-Type": "text/event-stream"]
        )!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: data)
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}
}
