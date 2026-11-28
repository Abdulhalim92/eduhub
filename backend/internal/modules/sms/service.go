// Package sms — биллинг SMS-пакетов (PLT-SMS): каталог, начисление центрам, история продаж.
// Начисление с баланса использует ledger (BR-005), ручное — основание billing.ValidateEvidence (BR-002).
package sms

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/line/eduhub-backend/internal/audit"
	"github.com/line/eduhub-backend/internal/idempotency"
	"github.com/line/eduhub-backend/internal/ledger"
	"github.com/line/eduhub-backend/internal/modules/billing"
	"github.com/line/eduhub-backend/pkg/apierr"
	"github.com/line/eduhub-backend/pkg/money"
	"gorm.io/gorm"
)

const (
	maxPackagePriceSomoni = 100_000
)

// Service реализует операции с SMS-пакетами.
type Service struct {
	db    *gorm.DB
	repo  *Repository
	audit *audit.Recorder
	idem  *idempotency.Store
}

// NewService создаёт сервис sms.
func NewService(repo *Repository, rec *audit.Recorder, idem *idempotency.Store) *Service {
	return &Service{db: repo.DB(), repo: repo, audit: rec, idem: idem}
}

func centerEntity(id int64, name string) (string, string) { return strconv.FormatInt(id, 10), name }

// Packages возвращает каталог пакетов со статистикой продаж и сводку.
func (s *Service) Packages(ctx context.Context) (PackagesResponse, error) {
	pkgs, err := s.repo.Packages(ctx)
	if err != nil {
		return PackagesResponse{}, err
	}
	sales, err := s.repo.AllSales(ctx)
	if err != nil {
		return PackagesResponse{}, err
	}
	sold := map[string]int{}
	centers := map[string]map[int64]bool{}
	meta := PackagesMeta{}
	for _, sale := range sales {
		sold[sale.PackageID]++
		if centers[sale.PackageID] == nil {
			centers[sale.PackageID] = map[int64]bool{}
		}
		centers[sale.PackageID][sale.CenterID] = true
		meta.Total += sale.Remaining
		if sale.Status == StatusPaid {
			meta.Revenue += sale.PriceDiram.Somoni()
		}
		if sale.low() {
			meta.Low++
		}
	}
	items := make([]PackageDTO, 0, len(pkgs))
	for _, p := range pkgs {
		items = append(items, PackageDTO{
			ID: p.ID, SMS: p.SMS, Price: p.PriceDiram, Description: p.Description, Active: p.Active,
			Sold: sold[p.ID], Centers: len(centers[p.ID]),
		})
	}
	return PackagesResponse{Items: items, Meta: meta}, nil
}

// Sales возвращает историю продаж по фильтрам и счётчики.
func (s *Service) Sales(ctx context.Context, q, status, packageID string, page, pageSize int) (SalesResponse, error) {
	all, err := s.repo.AllSales(ctx)
	if err != nil {
		return SalesResponse{}, err
	}
	names, err := s.repo.CenterNames(ctx)
	if err != nil {
		return SalesResponse{}, err
	}
	term := strings.ToLower(strings.TrimSpace(q))

	var counts SalesCounts
	filtered := make([]Sale, 0, len(all))
	for _, sale := range all {
		switch sale.Status {
		case StatusPaid:
			counts.Paid++
		case StatusBonus:
			counts.Bonus++
		}
		if sale.low() {
			counts.Low++
		}
		if !saleMatches(sale, names[sale.CenterID], term, status, packageID) {
			continue
		}
		filtered = append(filtered, sale)
	}

	total := len(filtered)
	start := (page - 1) * pageSize
	if start > total {
		start = total
	}
	end := start + pageSize
	if end > total {
		end = total
	}
	items := make([]SaleDTO, 0, end-start)
	for _, sale := range filtered[start:end] {
		items = append(items, toSaleDTO(sale, names[sale.CenterID]))
	}
	return SalesResponse{Items: items, Total: total, Page: page, PageSize: pageSize, Counts: counts}, nil
}

func saleMatches(sale Sale, center, term, status, packageID string) bool {
	if term != "" {
		hay := strings.ToLower(center + " " + sale.ID)
		if !strings.Contains(hay, term) {
			return false
		}
	}
	if packageID != "" && packageID != "all" && sale.PackageID != packageID {
		return false
	}
	switch status {
	case "", "all":
		return true
	case "low":
		return sale.low()
	default:
		return sale.Status == status
	}
}

// AccrueRequest — тело POST /sms/sales.
type AccrueRequest struct {
	CenterID       int64  `json:"centerId"`
	PackageID      string `json:"packageId"`
	Mode           string `json:"mode"`
	Method         string `json:"method"`
	Reference      string `json:"reference"`
	ReceivedAmount int64  `json:"receivedAmount"`
	ReceivedOn     string `json:"receivedOn"`
	Comment        string `json:"comment"`
	Confirmed      bool   `json:"confirmed"`
	Reason         string `json:"reason"`
}

// Accrue начисляет пакет центру (PLT-SMS-020). Идемпотентно.
func (s *Service) Accrue(ctx context.Context, actor audit.Actor, req AccrueRequest, idemKey string) (SaleDTO, error) {
	return idempotency.Do(ctx, s.db, s.idem, "sms.accrue", idemKey, func(tx *gorm.DB) (SaleDTO, error) {
		pkg, err := s.repo.Package(ctx, tx, req.PackageID)
		if err != nil {
			return SaleDTO{}, apierr.Field("Выберите пакет", "packageId", "Выберите пакет")
		}
		if !pkg.Active {
			return SaleDTO{}, apierr.Field("Выберите пакет", "packageId", "Пакет недоступен")
		}
		center, err := s.repo.Center(ctx, tx, req.CenterID)
		if err != nil {
			return SaleDTO{}, err
		}
		if center.Status != "active" {
			return SaleDTO{}, apierr.Conflict("Центр заблокирован: начисление пакета недоступно")
		}

		saleID, err := s.repo.NextSaleID(ctx, tx)
		if err != nil {
			return SaleDTO{}, err
		}
		sale := &Sale{
			ID: saleID, CenterID: center.ID, PackageID: pkg.ID, SMS: pkg.SMS, Remaining: pkg.SMS,
			PriceDiram: pkg.PriceDiram, BoughtAt: time.Now().UTC(), Status: StatusPaid, ActorName: actor.Name,
		}

		switch req.Mode {
		case ModeBalance:
			newBalance, err := ledger.Charge(ctx, tx, center.ID, pkg.PriceDiram, ledger.Meta{
				Method: "Списание с баланса на платформе", Reference: fmt.Sprintf("SMS-пакет %d (%s)", pkg.SMS, saleID), ActorName: actor.Name,
			})
			if err != nil {
				return SaleDTO{}, err
			}
			sale.Method = "Списание с баланса на платформе"
			sale.Reference = fmt.Sprintf("SMS-пакет %d", pkg.SMS)
			if err := s.audit.Log(ctx, tx, audit.Event{
				Actor: actor, Action: "balance.charge", EntityType: "center", EntityID: strconv.FormatInt(center.ID, 10),
				After: map[string]any{"balance": newBalance.Somoni()}, Reason: "SMS-пакет " + strconv.Itoa(pkg.SMS) + " · " + saleID,
			}); err != nil {
				return SaleDTO{}, err
			}
		case ModeManual:
			expected := pkg.PriceDiram.Somoni()
			fields, _ := billing.ValidateEvidence(billing.EvidenceInput{
				Method: req.Method, Reference: req.Reference, ReceivedAmount: req.ReceivedAmount, ReceivedOn: req.ReceivedOn, Comment: req.Comment, Confirmed: req.Confirmed,
			}, &expected, nil)
			if len(fields) > 0 {
				return SaleDTO{}, apierr.Validation("Проверьте данные оплаты", fields)
			}
			sale.Method = req.Method
			sale.Reference = strings.TrimSpace(req.Reference)
		case ModeBonus:
			if len([]rune(strings.TrimSpace(req.Reason))) < 5 {
				return SaleDTO{}, apierr.Field("Укажите причину (минимум 5 символов)", "reason", "Минимум 5 символов")
			}
			sale.Status = StatusBonus
			sale.PriceDiram = 0
			sale.Method = "Бесплатное начисление"
			sale.Reference = strings.TrimSpace(req.Reason)
			sale.Reason = strings.TrimSpace(req.Reason)
		default:
			return SaleDTO{}, apierr.Field("Выберите способ оплаты", "mode", "balance | manual | bonus")
		}

		if err := s.repo.CreateSale(ctx, tx, sale); err != nil {
			return SaleDTO{}, err
		}
		detail := sale.Method
		if sale.Status == StatusBonus {
			detail += " · " + sale.Reason
		} else if sale.Reference != "" {
			detail += " · " + sale.Reference
		}
		cid, name := centerEntity(center.ID, center.Name)
		if err := s.audit.Log(ctx, tx, audit.Event{
			Actor: actor, Action: "sms.accrued", EntityType: "center", EntityID: cid, EntityName: name,
			After: map[string]any{"sale": sale.ID, "sms": pkg.SMS, "status": sale.Status}, Reason: strconv.Itoa(pkg.SMS) + " SMS · " + detail,
		}); err != nil {
			return SaleDTO{}, err
		}
		return toSaleDTO(*sale, center.Name), nil
	})
}

// UpdatePackageRequest — тело PUT /sms/packages/{id}.
type UpdatePackageRequest struct {
	Price       *int64 `json:"price"`
	Description string `json:"description"`
	Reason      string `json:"reason"`
}

// UpdatePackage меняет цену/описание с причиной; новая цена — только для новых продаж (BR-020).
func (s *Service) UpdatePackage(ctx context.Context, actor audit.Actor, id string, req UpdatePackageRequest) (PackageDTO, error) {
	var out PackageDTO
	err := s.db.Transaction(func(tx *gorm.DB) error {
		pkg, err := s.repo.Package(ctx, tx, id)
		if err != nil {
			return err
		}
		desc := strings.TrimSpace(req.Description)
		fields := map[string]string{}
		if req.Price == nil || *req.Price < 1 || *req.Price > maxPackagePriceSomoni {
			fields["price"] = "Цена — целое число сомони от 1 до 100 000"
		}
		if n := len([]rune(desc)); n < 5 || n > 80 {
			fields["description"] = "Описание — от 5 до 80 символов"
		}
		if len([]rune(strings.TrimSpace(req.Reason))) < 5 {
			fields["reason"] = "Укажите причину (минимум 5 символов)"
		}
		if len(fields) == 0 && req.Price != nil && money.FromSomoni(*req.Price) == pkg.PriceDiram && desc == pkg.Description {
			fields["price"] = "Ничего не изменилось"
		}
		if len(fields) > 0 {
			return apierr.Validation("Проверьте данные пакета", fields)
		}
		before := map[string]any{"price": pkg.PriceDiram.Somoni(), "description": pkg.Description}
		pkg.PriceDiram = money.FromSomoni(*req.Price)
		pkg.Description = desc
		if err := s.repo.SavePackage(ctx, tx, pkg); err != nil {
			return err
		}
		if err := s.audit.Log(ctx, tx, audit.Event{
			Actor: actor, Action: "sms.package.updated", EntityType: "sms-package", EntityID: pkg.ID, EntityName: "Пакет " + strconv.Itoa(pkg.SMS) + " SMS",
			Before: before, After: map[string]any{"price": pkg.PriceDiram.Somoni(), "description": pkg.Description}, Reason: strings.TrimSpace(req.Reason),
		}); err != nil {
			return err
		}
		out = PackageDTO{ID: pkg.ID, SMS: pkg.SMS, Price: pkg.PriceDiram, Description: pkg.Description, Active: pkg.Active}
		return nil
	})
	return out, err
}
