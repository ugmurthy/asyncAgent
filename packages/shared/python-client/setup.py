from setuptools import setup, find_packages
import os

VERSION = "0.1.0"

setup(
    name="async-agent-client",
    version=VERSION,
    description="Python client for Async Agent API",
    long_description=open("README.md").read() if os.path.exists("README.md") else "",
    long_description_content_type="text/markdown",
    author="Async Agent Team",
    license="MIT",
    packages=find_packages(where=".", exclude=["tests", "tests.*"]),
    python_requires=">=3.8",
    install_requires=[
        "httpx>=0.23.0",
        "attrs>=21.3.0",
        "python-dateutil>=2.8.0",
    ],
    classifiers=[
        "Development Status :: 3 - Alpha",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
    ],
    keywords="async-agent api-client openapi",
)
