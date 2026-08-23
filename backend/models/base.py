from extensions import db

# Flask-SQLAlchemy's db.Model (in 3.x) is already a DeclarativeBase subclass and it
# supports Mapped/mapped_column out of the box. So instead of building its own DeclarativeBase,
# its neccesary to import db from extensions.py and make it to inherit from db.Model

class Base(db.Model):

    #To indicate to sqlalchemy that Base is not a table but a "Parent class". 
    #New SQLAlchemy ver already knows it, however, it's a good practice to add this line
    __abstract__ = True

    #To specify to sqlalchemy what schema we are using
    __table_args__ = {"schema": "public"}



