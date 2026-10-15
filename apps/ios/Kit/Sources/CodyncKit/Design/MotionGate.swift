import SwiftUI

/// A view's motion policy follows its environment, including live setting changes.
@MainActor
public struct MotionGate: DynamicProperty {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    public init() {}

    public var isReduced: Bool { reduceMotion }

    public func resolve(_ animation: Animation?) -> Animation? {
        animation.flatMap { Motion.reduced($0, reduceMotion) }
    }

    public func animate(_ animation: Animation?, _ change: () -> Void) {
        withAnimation(resolve(animation), change)
    }
}

public extension View {
    /// Use instead of an ungated `.animation(_:value:)` in a view.
    func motionAnimation<Value: Equatable>(_ animation: Animation?, value: Value) -> some View {
        modifier(MotionAnimation(animation: animation, value: value))
    }
}

private struct MotionAnimation<Value: Equatable>: ViewModifier {
    let animation: Animation?
    let value: Value
    var motion = MotionGate()

    func body(content: Content) -> some View {
        content.animation(motion.resolve(animation), value: value)
    }
}
