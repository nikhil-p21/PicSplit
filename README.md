# PicSplit

PicSplit is a web application that splits bills from images using Optical Character Recognition (OCR) and provides an easy way to manage shared expenses.

## Features

- Upload an image of a bill and extract text automatically.
- Identify and split individual items among users.
- Generate an equal or custom split for payments.
- Simple and user-friendly Streamlit interface.

## Prerequisites

Ensure you have **Poetry** installed. If not, install it using:

```sh
pip install poetry
```

## Installation

Clone the repository and navigate to the project folder:

```sh
git clone https://github.com/nikhil-p21/PicSplit.git
cd PicSplit
```

Install dependencies using Poetry:

```sh
poetry install
```

## Running the Web App

Activate the virtual environment (if not already activated):

```sh
poetry shell
```

Run the Streamlit app:

```sh
streamlit run app.py
```

## Project Structure

```
📦 PicSplit
├── app.py          # Main Streamlit application file
├── pyproject.toml  # Poetry configuration file
├── README.md       # Project documentation
└── ...            # Other project files
```

## Contributing

1. Fork the repository.
2. Create a new branch (`git checkout -b feature-branch`).
3. Make your changes and commit (`git commit -m 'Add some feature'`).
4. Push to the branch (`git push origin feature-branch`).
5. Open a pull request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contact

For any questions or suggestions, feel free to reach out!

