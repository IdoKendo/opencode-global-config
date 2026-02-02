# Kubernetes Controllers

> Reference for: Golang Pro
> Load when: Kubernetes controllers, reconcile loops, CRDs, controller-runtime

## Basic Structure

```go
import (
    "os"

    ctrl "sigs.k8s.io/controller-runtime"
    "sigs.k8s.io/controller-runtime/pkg/healthz"
    "sigs.k8s.io/controller-runtime/pkg/log/zap"
)

func main() {
    ctrl.SetLogger(zap.New(zap.UseDevMode(true)))

    mgr, err := ctrl.NewManager(ctrl.GetConfigOrDie(), ctrl.Options{
        Scheme:                 scheme,
        MetricsBindAddress:     ":8080",
        HealthProbeBindAddress: ":8081",
        LeaderElection:         true,
        LeaderElectionID:       "example-controller",
    })
    if err != nil {
        os.Exit(1)
    }

    if err := mgr.AddHealthzCheck("healthz", healthz.Ping); err != nil {
        os.Exit(1)
    }
    if err := mgr.AddReadyzCheck("readyz", healthz.Ping); err != nil {
        os.Exit(1)
    }

    if err := (&WidgetReconciler{Client: mgr.GetClient(), Scheme: mgr.GetScheme()}).
        SetupWithManager(mgr); err != nil {
        os.Exit(1)
    }

    if err := mgr.Start(ctrl.SetupSignalHandler()); err != nil {
        os.Exit(1)
    }
}
```

## RBAC + Scheme Registration

```go
import (
    "k8s.io/apimachinery/pkg/runtime"
    clientgoscheme "k8s.io/client-go/kubernetes/scheme"
    myv1 "example.com/api/v1"
)

var scheme = runtime.NewScheme()

func init() {
    _ = clientgoscheme.AddToScheme(scheme)
    _ = myv1.AddToScheme(scheme)
}
```

## Reconcile Patterns

### Read-Create-Update Loop

```go
func (r *WidgetReconciler) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
    var widget myv1.Widget
    if err := r.Get(ctx, req.NamespacedName, &widget); err != nil {
        if apierrors.IsNotFound(err) {
            return ctrl.Result{}, nil
        }
        return ctrl.Result{}, err
    }

    if !widget.DeletionTimestamp.IsZero() {
        return r.handleDeletion(ctx, &widget)
    }

    if widget.Spec.Replicas == nil {
        widget.Spec.Replicas = ptr.To[int32](1)
        if err := r.Update(ctx, &widget); err != nil {
            return ctrl.Result{}, err
        }
    }

    return ctrl.Result{}, nil
}
```

### Transient Errors and Backoff

```go
func requeueOnError(err error) (ctrl.Result, error) {
    if err == nil {
        return ctrl.Result{}, nil
    }

    if apierrors.IsConflict(err) || apierrors.IsServerTimeout(err) {
        return ctrl.Result{RequeueAfter: 5 * time.Second}, nil
    }

    return ctrl.Result{}, err
}
```

## Status and Conditions

```go
func (r *WidgetReconciler) updateStatus(ctx context.Context, widget *myv1.Widget, reason string) error {
    base := widget.DeepCopy()
    meta.SetStatusCondition(&widget.Status.Conditions, metav1.Condition{
        Type:               "Ready",
        Status:             metav1.ConditionTrue,
        Reason:             reason,
        ObservedGeneration: widget.GetGeneration(),
        LastTransitionTime: metav1.Now(),
    })
    return r.Status().Patch(ctx, widget, client.MergeFrom(base))
}
```

## Finalizers and Deletion

```go
const finalizerName = "example.com/finalizer"

func (r *WidgetReconciler) ensureFinalizer(ctx context.Context, widget *myv1.Widget) error {
    if controllerutil.ContainsFinalizer(widget, finalizerName) {
        return nil
    }
    controllerutil.AddFinalizer(widget, finalizerName)
    return r.Update(ctx, widget)
}

func (r *WidgetReconciler) handleDeletion(ctx context.Context, widget *myv1.Widget) (ctrl.Result, error) {
    if !widget.DeletionTimestamp.IsZero() {
        if controllerutil.ContainsFinalizer(widget, finalizerName) {
            if err := r.cleanupExternalResources(ctx, widget); err != nil {
                return ctrl.Result{RequeueAfter: 10 * time.Second}, err
            }
            controllerutil.RemoveFinalizer(widget, finalizerName)
            return ctrl.Result{}, r.Update(ctx, widget)
        }
    }
    return ctrl.Result{}, nil
}
```

## Owner References and Garbage Collection

```go
func (r *WidgetReconciler) ensureOwned(ctx context.Context, widget *myv1.Widget) error {
    deployment := &appsv1.Deployment{
        ObjectMeta: metav1.ObjectMeta{
            Name:      widget.Name,
            Namespace: widget.Namespace,
        },
    }

    _, err := controllerutil.CreateOrUpdate(ctx, r.Client, deployment, func() error {
        return controllerutil.SetControllerReference(widget, deployment, r.Scheme)
    })
    return err
}
```

## Event Filters and Predicates

```go
import "sigs.k8s.io/controller-runtime/pkg/predicate"

func (r *WidgetReconciler) SetupWithManager(mgr ctrl.Manager) error {
    return ctrl.NewControllerManagedBy(mgr).
        For(&myv1.Widget{}).
        WithEventFilter(predicate.GenerationChangedPredicate{}).
        Complete(r)
}
```

## Quick checklist

- Use `context.Context` for all API calls
- Requeue on transient errors with backoff
- Avoid busy loops and tight resyncs
- Ensure cache sync when bypassing `mgr.Start`
- Use structured logging consistently
- Update status with conditions and `ObservedGeneration`
- Handle finalizers before delete completion

## Testing Patterns

### Fake Client Unit Tests

```go
func TestReconcileCreatesDefaults(t *testing.T) {
    scheme := runtime.NewScheme()
    _ = myv1.AddToScheme(scheme)

    widget := &myv1.Widget{
        ObjectMeta: metav1.ObjectMeta{Name: "example", Namespace: "default"},
    }

    client := fake.NewClientBuilder().WithScheme(scheme).WithObjects(widget).Build()
    reconciler := &WidgetReconciler{Client: client, Scheme: scheme}

    _, err := reconciler.Reconcile(context.Background(), ctrl.Request{
        NamespacedName: types.NamespacedName{Name: "example", Namespace: "default"},
    })
    require.NoError(t, err)
}
```

### envtest Integration Tests

```go
testEnv := &envtest.Environment{
    CRDDirectoryPaths: []string{filepath.Join("..", "config", "crd", "bases")},
}

cfg, err := testEnv.Start()
require.NoError(t, err)

defer func() {
    _ = testEnv.Stop()
}()
```

## Quick reference

| Area | Do | Don't | Notes |
| --- | --- | --- | --- |
| Manager | Use `ctrl.NewManager` with leader election | Skip health probes | Probes support liveness/readiness |
| Scheme | Register core + CRDs in `init()` | Forget `AddToScheme` | Missing types cause decode errors |
| Reconcile | Return `err` for transient failures | Return `err` + `RequeueAfter` | Error already triggers backoff |
| Status | Use `Status().Patch` with merge | Update spec + status together | Keep spec and status separate |
| Finalizers | Early-return on deletion | Continue normal reconcile | Avoid double-work on delete |
| Ownership | Use `CreateOrUpdate` + controller ref | Blindly create children | Prevent AlreadyExists errors |
| Events | Use `GenerationChangedPredicate` intentionally | Filter all updates by default | Status-only changes won’t trigger |
| Tests | Fake client for unit tests | Rely only on envtest | envtest for cache/controller behavior |
