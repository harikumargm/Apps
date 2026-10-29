FROM python:3.12-slim

WORKDIR /srv
COPY services/vision /srv
RUN pip install --no-cache-dir -r requirements.txt
ENV PYTHONPATH=/srv
EXPOSE 8001
CMD ["uvicorn", "sutra_vision.server:app", "--host", "0.0.0.0", "--port", "8001"]
