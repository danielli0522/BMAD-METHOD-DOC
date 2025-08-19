#!/usr/bin/env python3
"""
Serena AMQP Client Example
==========================

This example demonstrates how to use the Serena AMQP client library
to connect to a message queue and send/receive messages.
"""

import asyncio
import serena
from serena import AMQPConnection, AMQPMessage


async def producer_example():
    """Example of a message producer using Serena."""
    print("🚀 Starting Serena AMQP Producer Example")
    
    # Connect to AMQP server (RabbitMQ)
    async with AMQPConnection("amqp://localhost") as connection:
        async with connection.channel() as channel:
            # Declare a queue
            await channel.queue_declare("test_queue", durable=True)
            
            # Send a message
            message = AMQPMessage(
                body="Hello from Serena!",
                delivery_mode=2  # Persistent message
            )
            
            await channel.basic_publish(
                message,
                exchange="",
                routing_key="test_queue"
            )
            
            print("✅ Message sent successfully!")


async def consumer_example():
    """Example of a message consumer using Serena."""
    print("📥 Starting Serena AMQP Consumer Example")
    
    # Connect to AMQP server (RabbitMQ)
    async with AMQPConnection("amqp://localhost") as connection:
        async with connection.channel() as channel:
            # Declare a queue
            await channel.queue_declare("test_queue", durable=True)
            
            # Set up consumer
            async def message_handler(message: AMQPMessage):
                print(f"📨 Received message: {message.body.decode()}")
                await channel.basic_ack(message.delivery.delivery_tag)
            
            # Start consuming messages
            await channel.basic_consume("test_queue", message_handler)
            print("👂 Listening for messages... (Press Ctrl+C to stop)")
            
            # Keep the consumer running
            try:
                await asyncio.sleep(30)  # Listen for 30 seconds
            except KeyboardInterrupt:
                print("\n🛑 Consumer stopped by user")


async def main():
    """Main function to demonstrate Serena usage."""
    print("=" * 50)
    print("🎯 Serena AMQP Client Example")
    print("=" * 50)
    
    print("\n📋 Serena Features:")
    print("• AMQP 0-9-1 client using AnyIO")
    print("• Async/await support")
    print("• Connection and channel management")
    print("• Message publishing and consuming")
    print("• Queue declaration and management")
    
    print("\n⚠️  Note: This example requires a running RabbitMQ server.")
    print("   You can install RabbitMQ using: brew install rabbitmq")
    
    print("\n🔧 Usage Examples:")
    print("1. Producer: python serena_example.py --producer")
    print("2. Consumer: python serena_example.py --consumer")
    print("3. Both:     python serena_example.py --both")
    
    # Check if RabbitMQ is running
    try:
        connection = await AMQPConnection("amqp://localhost").open()
        await connection.close()
        print("\n✅ RabbitMQ connection successful!")
    except Exception as e:
        print(f"\n❌ RabbitMQ connection failed: {e}")
        print("   Please start RabbitMQ server first.")


if __name__ == "__main__":
    import sys
    
    if "--producer" in sys.argv:
        asyncio.run(producer_example())
    elif "--consumer" in sys.argv:
        asyncio.run(consumer_example())
    elif "--both" in sys.argv:
        async def run_both():
            await producer_example()
            await consumer_example()
        asyncio.run(run_both())
    else:
        asyncio.run(main())
