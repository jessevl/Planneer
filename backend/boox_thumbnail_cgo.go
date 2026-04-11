//go:build cgo && !nocgo

package main

import (
	"bytes"
	"image"
	"image/png"

	"github.com/disintegration/imaging"
	"github.com/gen2brain/go-fitz"
)

const (
	maxBooxThumbnailSize = 2 * 1024 * 1024
	booxThumbnailWidth   = 720
	booxThumbnailHeight  = 1024
	booxThumbnailDPI     = 110.0
)

// generatePDFLastPageThumbnail renders the last page of pdfData via go-fitz
// and returns a PNG thumbnail plus the document page count.
func generatePDFLastPageThumbnail(pdfData []byte) ([]byte, int, error) {
	doc, err := fitz.NewFromMemory(pdfData)
	if err != nil {
		return nil, 0, err
	}
	defer doc.Close()

	pageCount := doc.NumPage()
	if pageCount <= 0 {
		return nil, 0, nil
	}

	img, err := doc.ImageDPI(pageCount-1, booxThumbnailDPI)
	if err != nil {
		return nil, pageCount, err
	}

	thumbData, err := encodeBOOXThumbnailPNG(img)
	if err != nil {
		return nil, pageCount, err
	}

	return thumbData, pageCount, nil
}

func encodeBOOXThumbnailPNG(img image.Image) ([]byte, error) {
	resized := imaging.Fit(img, booxThumbnailWidth, booxThumbnailHeight, imaging.Lanczos)

	for attempt := 0; attempt < 5; attempt++ {
		var buf bytes.Buffer
		encoder := png.Encoder{CompressionLevel: png.BestCompression}
		if err := encoder.Encode(&buf, resized); err != nil {
			return nil, err
		}

		if buf.Len() <= maxBooxThumbnailSize {
			return buf.Bytes(), nil
		}

		nextWidth := resized.Bounds().Dx() * 85 / 100
		if nextWidth < 200 {
			nextWidth = 200
		}
		resized = imaging.Resize(resized, nextWidth, 0, imaging.Lanczos)
	}

	var buf bytes.Buffer
	encoder := png.Encoder{CompressionLevel: png.BestCompression}
	if err := encoder.Encode(&buf, resized); err != nil {
		return nil, err
	}

	return buf.Bytes(), nil
}
