import './Card.css';

const Card = ({ 
  children, 
  className = '', 
  header, 
  headerIcon,
  headerAction,
  ...props 
}) => {
  return (
    <div className={`card ${className}`} {...props}>
      {header && (
        <div className="card-header">
          {headerIcon && <div className="card-header-icon">{headerIcon}</div>}
          <h2 className="card-header-title">{header}</h2>
          {headerAction && <div className="card-header-action">{headerAction}</div>}
        </div>
      )}
      <div className="card-content">
        {children}
      </div>
    </div>
  );
};

export default Card;
