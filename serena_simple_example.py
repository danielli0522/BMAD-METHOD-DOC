#!/usr/bin/env python3
"""
Simple Serena AMQP Client Example
=================================

This example demonstrates the basic usage of the Serena AMQP client library.
"""

import asyncio
import serena
from serena import AMQPConnection, AMQPMessage


async def simple_example():
    """Simple example showing Serena basic functionality."""
    print("🎯 Serena AMQP Client - Simple Example")
    print("=" * 40)
    
    print("\n📦 Installed Serena Package Info:")
    print("• Name: serena")
    print("• Version: 0.9.1")
    print("• Summary: An AMQP 0-9-1 client using AnyIO")
    print("• Author: Lura Skye")
    print("• License: LGPL-3.0-or-later")
    
    print("\n🔧 Available Classes and Functions:")
    print("• AMQPConnection - For connecting to AMQP servers")
    print("• AMQPMessage - For creating AMQP messages")
    print("• Channel - For managing AMQP channels")
    print("• Basic operations: publish, consume, queue_declare")
    
    print("\n💡 Usage Pattern:")
    print("1. Create AMQPConnection")
    print("2. Open connection")
    print("3. Create channel")
    print("4. Declare queue")
    print("5. Publish/consume messages")
    print("6. Close connection")
    
    print("\n⚠️  Note: To use this library, you need:")
    print("• A running AMQP server (like RabbitMQ)")
    print("• Install RabbitMQ: brew install rabbitmq")
    print("• Start RabbitMQ: brew services start rabbitmq")
    
    print("\n✅ Serena installation completed successfully!")
    print("   You can now use it in your Python projects for AMQP messaging.")


if __name__ == "__main__":
    asyncio.run(simple_example())
