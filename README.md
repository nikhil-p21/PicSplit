# PicSplit

PicSplit is a web app that allows users to split bills from images easily. Upload an image of a receipt, and the app extracts and divides the bill among participants.

## Features

- Extracts text from images to identify items and prices.
- Splits bills fairly among participants.
- User-friendly interface powered by Streamlit.
- Uses Poetry for package management.

## Prerequisites

Ensure you have **Poetry** installed. If not, install it using:

```sh
pip install poetry
```

Additionally, add the Poetry shell plugin:

```sh
poetry self add poetry-plugin-shell
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

