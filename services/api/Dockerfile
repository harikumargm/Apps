FROM python:3.12-slim

WORKDIR /srv
COPY services/vision /srv/services/vision
COPY services/api /srv/services/api
COPY data /srv/data
RUN pip install --no-cache-dir -r /srv/services/api/requirements.txt
ENV PYTHONPATH=/srv/services/vision
WORKDIR /srv/services/api
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
